import { describe, it, expect, vi } from 'vitest'

// electron/ipcMain durch einen EventEmitter ersetzen, damit der Adapter ohne Electron testbar ist.
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  return { ipcMain: new EventEmitter() }
})

import { ipcMain } from 'electron'
import { createRecorder } from '@main/recording/recorder-adapter'

function fakeFenster() {
  return { webContents: { send: vi.fn() } } as never
}

describe('createRecorder', () => {
  it('stop() löst mit Audio-Blob + Dauer auf, wenn recorder:result kommt', async () => {
    const recorder = createRecorder(fakeFenster())
    const stopP = recorder.stop()

    ;(ipcMain as unknown as { emit: (c: string, ...a: unknown[]) => void }).emit(
      'recorder:result',
      {},
      { buffer: new ArrayBuffer(3), durationSeconds: 1.2, mimeType: 'audio/webm' }
    )

    const res = await stopP
    expect(res.durationSeconds).toBe(1.2)
    expect(res.audio.type).toBe('audio/webm')
  })

  it('discard() rejected den offenen stop()-Promise mit AbortError (kein Hänger)', async () => {
    const recorder = createRecorder(fakeFenster())
    const stopP = recorder.stop()

    recorder.discard()

    await expect(stopP).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('recorder:error rejected den stop()-Promise mit der Meldung', async () => {
    const recorder = createRecorder(fakeFenster())
    const stopP = recorder.stop()

    ;(ipcMain as unknown as { emit: (c: string, ...a: unknown[]) => void }).emit(
      'recorder:error',
      {},
      'Mikrofon nicht verfügbar'
    )

    await expect(stopP).rejects.toThrow(/Mikrofon nicht verfügbar/)
  })
})
