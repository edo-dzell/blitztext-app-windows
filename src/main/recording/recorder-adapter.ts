// Recorder-Adapter (#03/#11, HITL/Windows): erfüllt den Recorder-Port des Runners. MediaRecorder ist
// eine Renderer-API → der Main-Prozess kann nicht direkt aufnehmen. Topologie (Designentscheidung
// #11): ein VERSTECKTER Renderer (recorder.html) nimmt auf und schickt den Audio-Blob per IPC zurück.
// start/stop/discard sind Befehle an dieses Fenster; stop() löst auf, sobald 'recorder:result' kommt.
// Nicht headless verifizierbar (echtes Mikrofon/MediaRecorder) — Laufzeit-Abnahme auf Windows.

import { ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron'
import type { Recorder, RecordingResult } from '@main/workflow/runner'

interface RecorderErgebnis {
  buffer: ArrayBuffer
  durationSeconds: number
  mimeType: string
}

export function createRecorder(fenster: BrowserWindow): Recorder {
  // Bricht einen wartenden stop()-Promise ab (z. B. bei discard); null, wenn kein stop läuft.
  let brichLaufendenStopAb: (() => void) | null = null

  return {
    start() {
      fenster.webContents.send('recorder:start')
    },
    discard() {
      fenster.webContents.send('recorder:discard')
      // Einen evtl. wartenden stop() rejecten, damit der Await nicht hängt (#03/S-8).
      brichLaufendenStopAb?.()
    },
    stop() {
      return new Promise<RecordingResult>((resolve, reject) => {
        const aufraeumen = (): void => {
          ipcMain.removeListener('recorder:result', onResult)
          ipcMain.removeListener('recorder:error', onError)
          brichLaufendenStopAb = null
        }
        const onResult = (_e: IpcMainEvent, data: RecorderErgebnis): void => {
          aufraeumen()
          // MIME-Type setzen, sonst sendet undici application/octet-stream → OpenAI 400 (RESEARCH §5).
          resolve({
            audio: new Blob([data.buffer], { type: data.mimeType || 'audio/webm' }),
            durationSeconds: data.durationSeconds
          })
        }
        const onError = (_e: IpcMainEvent, message: string): void => {
          aufraeumen()
          reject(new Error(message))
        }
        brichLaufendenStopAb = (): void => {
          aufraeumen()
          reject(new DOMException('Aufnahme verworfen.', 'AbortError'))
        }
        ipcMain.once('recorder:result', onResult)
        ipcMain.once('recorder:error', onError)
        fenster.webContents.send('recorder:stop')
      })
    }
  }
}
