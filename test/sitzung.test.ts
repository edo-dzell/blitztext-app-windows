import { describe, it, expect } from 'vitest'
import { createSitzung, type Ausgabe, type Abschlussdaten } from '@main/session/sitzung'
import type { FehlerMeldung } from '@main/session/fehler-meldung'
import { createWorkflowRunner } from '@main/workflow/runner'
import { createSettingsStore, type BlitztextSettings } from '@main/settings/store'
import * as quality from '@main/transcription/quality'
import { resolveSystemPrompt } from '@main/rewrite/prompt-builder'

const audio = new Blob(['x'], { type: 'audio/webm' })

interface MakeOpts {
  hasKey?: boolean
  durationSeconds?: number
  transcript?: string
  rewritten?: string
  settings?: Partial<BlitztextSettings>
  captureTranscribe?: (options?: { language?: string; vocabularyHints?: string[] }) => void
  /** Transkription hängt, bis ihr Abbruch-Signal feuert (für Abbruch-während-Stopp-Tests). */
  hangUntilAbort?: boolean
  /** Simuliert, ob der Verlauf tatsächlich geschrieben hat (steuert onHistoryChanged, P5b). */
  verlaufGeschrieben?: boolean
  /** Lässt die Transkription werfen (für Fehlerpfad-Tests). */
  transcribeFehler?: Error
  /** Lässt das Umschreiben werfen (für Teil-Erfolg-Tests). */
  rewriteFehler?: Error
  /** Lässt das Protokoll-Schreiben werfen (für die Crash-Härtung A5). */
  protokollWirft?: boolean
}

function makeSitzung(opts: MakeOpts = {}) {
  const recorder = {
    started: 0,
    stopped: 0,
    discarded: 0,
    start(): void {
      recorder.started++
    },
    async stop() {
      recorder.stopped++
      return { audio, durationSeconds: opts.durationSeconds ?? 1.5 }
    },
    discard(): void {
      recorder.discarded++
    }
  }
  const runner = createWorkflowRunner({
    recorder,
    transcription: {
      async transcribe(_audio, options) {
        opts.captureTranscribe?.(options)
        if (opts.transcribeFehler) throw opts.transcribeFehler
        if (opts.hangUntilAbort) {
          return await new Promise<string>((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError'))
            )
          })
        }
        return opts.transcript ?? 'roh'
      }
    },
    rewrite: {
      async rewrite() {
        if (opts.rewriteFehler) throw opts.rewriteFehler
        return { text: opts.rewritten ?? 'umgeschrieben' }
      }
    },
    resolveSystemPrompt,
    quality
  })

  let content: string | null = opts.settings ? JSON.stringify(opts.settings) : null
  const einstellungen = createSettingsStore({
    file: {
      async read() {
        return content
      },
      async write(next) {
        content = next
      }
    }
  })

  const calls = {
    einfügen: [] as string[],
    anzeigen: [] as string[],
    zeigeEinstellungen: 0,
    melde: [] as FehlerMeldung[],
    inZwischenablage: [] as string[]
  }
  const ausgabe: Ausgabe = {
    einfügen: (t) => calls.einfügen.push(t),
    anzeigen: (t) => calls.anzeigen.push(t),
    zeigeEinstellungen: () => {
      calls.zeigeEinstellungen++
    },
    melde: (f) => calls.melde.push(f),
    inZwischenablage: (t) => calls.inZwischenablage.push(t)
  }

  const apiKeys = {
    async has() {
      return opts.hasKey ?? true
    }
  }

  const protokollDaten: Abschlussdaten[] = []
  const protokoll = {
    aufzeichnen: async (d: Abschlussdaten) => {
      if (opts.protokollWirft) throw new Error('Disk voll')
      protokollDaten.push(d)
      return opts.verlaufGeschrieben ?? true
    }
  }
  const historyChanges = { n: 0 }

  const sitzung = createSitzung({
    runner,
    einstellungen,
    apiKeys,
    ausgabe,
    protokoll,
    onHistoryChanged: () => {
      historyChanges.n++
    }
  })
  return { sitzung, calls, recorder, protokollDaten, historyChanges }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('createSitzung', () => {
  it('hotkey: starteWorkflow → stoppe fügt den gesäuberten Endtext ins Paste-Ziel ein', async () => {
    const { sitzung, calls } = makeSitzung({ transcript: '  hallo welt  ' })

    await sitzung.starteWorkflow('transcribe', 'hotkey')
    await sitzung.stoppe()

    expect(calls.einfügen).toEqual(['hallo welt'])
    expect(calls.anzeigen).toEqual([])
  })

  it('manuell: stoppe zeigt den Endtext im Fenster statt einzufügen', async () => {
    const { sitzung, calls } = makeSitzung({ transcript: 'angezeigter text' })

    await sitzung.starteWorkflow('transcribe', 'manuell')
    await sitzung.stoppe()

    expect(calls.anzeigen).toEqual(['angezeigter text'])
    expect(calls.einfügen).toEqual([])
  })

  it('kein API-Key + manuell: zeigt die Einstellungen und nimmt gar nicht erst auf', async () => {
    const { sitzung, calls, recorder } = makeSitzung({ hasKey: false })

    await sitzung.starteWorkflow('transcribe', 'manuell')

    expect(calls.zeigeEinstellungen).toBe(1)
    expect(recorder.started).toBe(0)
    expect(calls.einfügen).toEqual([])
    expect(calls.anzeigen).toEqual([])
  })

  it('kein API-Key + hotkey: bricht still ab (keine Einstellungen, keine Aufnahme)', async () => {
    const { sitzung, calls, recorder } = makeSitzung({ hasKey: false })

    await sitzung.starteWorkflow('transcribe', 'hotkey')

    expect(calls.zeigeEinstellungen).toBe(0)
    expect(recorder.started).toBe(0)
    expect(calls.einfügen).toEqual([])
  })

  it('Desync-Schutz: ein zweites stoppe() ohne aktiven Lauf löst keinen Phantom-Stop aus', async () => {
    const { sitzung, calls, recorder, protokollDaten } = makeSitzung({ transcript: 'hallo' })

    await sitzung.starteWorkflow('transcribe', 'hotkey')
    await sitzung.stoppe()
    await tick() // protokolliere ist fire-and-forget
    expect(calls.einfügen).toEqual(['hallo'])
    expect(recorder.stopped).toBe(1)
    expect(protokollDaten.length).toBe(1)

    // Phantom-Stop (Dispatcher-Desync nach verworfenem Zweitstart): kein aktiver Lauf → no-op.
    // Kein zweiter recorder.stop ('Keine aktive Aufnahme'), kein Doppel-Einfügen, kein Doppel-Verlauf.
    await sitzung.stoppe()
    await tick()
    expect(recorder.stopped).toBe(1)
    expect(calls.einfügen).toEqual(['hallo'])
    expect(protokollDaten.length).toBe(1)
  })

  it('ignoriert ein zweites starteWorkflow, solange ein Lauf aktiv ist', async () => {
    const { sitzung, recorder } = makeSitzung()

    await sitzung.starteWorkflow('transcribe', 'hotkey')
    await sitzung.starteWorkflow('improve', 'manuell') // soll verworfen werden

    expect(recorder.started).toBe(1)
  })

  it('brichAb verwirft den laufenden Lauf, gibt nichts aus und gibt die Sitzung frei', async () => {
    const { sitzung, calls, recorder } = makeSitzung()

    await sitzung.starteWorkflow('transcribe', 'hotkey')
    sitzung.brichAb()

    expect(recorder.discarded).toBe(1)
    expect(calls.einfügen).toEqual([])
    expect(calls.anzeigen).toEqual([])

    // nach Abbruch ist die Sitzung wieder frei für eine neue Auslösung
    await sitzung.starteWorkflow('transcribe', 'manuell')
    expect(recorder.started).toBe(2)
  })

  it('Abbruch während eines laufenden Stopps gibt nichts aus und gibt die Sitzung frei', async () => {
    const { sitzung, calls, protokollDaten } = makeSitzung({ hangUntilAbort: true })

    await sitzung.starteWorkflow('transcribe', 'hotkey')
    const stopP = sitzung.stoppe()
    await new Promise((r) => setTimeout(r, 0))

    sitzung.brichAb()
    await stopP

    expect(calls.einfügen).toEqual([])
    expect(calls.anzeigen).toEqual([])
    expect(protokollDaten).toEqual([])
    expect(sitzung.beschaeftigt()).toBe(false)
  })

  it('lädt die Einstellungen und speist Sprache + Eigene Begriffe in die Transkription', async () => {
    let captured: { language?: string; vocabularyHints?: string[] } | undefined
    const { sitzung } = makeSitzung({
      settings: { language: 'en', customTerms: ['Acme', 'Blitztext'] },
      durationSeconds: 1.5,
      captureTranscribe: (o) => {
        captured = o
      }
    })

    await sitzung.starteWorkflow('transcribe', 'manuell')
    await sitzung.stoppe()

    expect(captured?.language).toBe('en')
    expect(captured?.vocabularyHints).toEqual(['Acme', 'Blitztext'])
  })

  it('protokolliert einen fertigen Lauf mit Label + Modellen (Telemetrie aus letzteMetrik)', async () => {
    const { sitzung, protokollDaten } = makeSitzung({
      transcript: 'roh',
      rewritten: 'fertig',
      settings: {
        anbieter: [
          {
            id: 'openai',
            vorlage: 'openai',
            label: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            asrModell: 'whisper-1',
            chatModell: 'gpt-4o-mini'
          }
        ],
        standardAnbieterId: 'openai'
      }
    })

    await sitzung.starteWorkflow('improve', 'hotkey')
    await sitzung.stoppe()

    expect(protokollDaten).toHaveLength(1)
    expect(protokollDaten[0]).toMatchObject({
      workflowId: 'improve',
      workflowLabel: 'Blitztext+',
      rohtext: 'roh',
      endtext: 'fertig',
      asrModell: 'whisper-1',
      chatModell: 'gpt-4o-mini',
      umgeschrieben: true
    })
  })

  it('reine Transkription: protokolliert chatModell="" und umgeschrieben=false', async () => {
    const { sitzung, protokollDaten } = makeSitzung({ transcript: 'nur text' })
    await sitzung.starteWorkflow('transcribe', 'hotkey')
    await sitzung.stoppe()
    expect(protokollDaten[0]).toMatchObject({ chatModell: '', umgeschrieben: false })
  })

  it('leitet die Phasen des Runners an onStatus weiter (für Tray/Fenster)', async () => {
    const { sitzung } = makeSitzung({ transcript: 'hallo' })
    const phasen: string[] = []
    sitzung.onStatus = (p) => phasen.push(p.status)

    await sitzung.starteWorkflow('transcribe', 'manuell')
    await sitzung.stoppe()

    expect(phasen).toEqual(['aufnehmen', 'transkribieren', 'fertig'])
  })

  it('feuert onHistoryChanged genau einmal nach einem geschriebenen Lauf (P5b)', async () => {
    const { sitzung, historyChanges } = makeSitzung({ transcript: 'x' })
    await sitzung.starteWorkflow('transcribe', 'hotkey')
    await sitzung.stoppe()
    await tick() // protokolliere ist fire-and-forget → einen Microtask-Durchlauf abwarten
    expect(historyChanges.n).toBe(1)
  })

  it('feuert onHistoryChanged NICHT, wenn der Verlauf nichts geschrieben hat (inaktiv)', async () => {
    const { sitzung, historyChanges } = makeSitzung({ transcript: 'x', verlaufGeschrieben: false })
    await sitzung.starteWorkflow('transcribe', 'hotkey')
    await sitzung.stoppe()
    await tick()
    expect(historyChanges.n).toBe(0)
  })

  it('feuert onHistoryChanged NICHT bei Abbruch', async () => {
    const { sitzung, historyChanges } = makeSitzung()
    await sitzung.starteWorkflow('transcribe', 'hotkey')
    sitzung.brichAb()
    await tick()
    expect(historyChanges.n).toBe(0)
  })

  it('fehler: meldet einen fehlgeschlagenen Lauf, fügt nichts ein (konfiguration → Sprung-Aktion)', async () => {
    const { sitzung, calls } = makeSitzung({
      transcribeFehler: Object.assign(new Error('Ungültiger Key'), { status: 401 })
    })

    await sitzung.starteWorkflow('improve', 'hotkey')
    await sitzung.stoppe()

    expect(calls.einfügen).toEqual([])
    expect(calls.melde).toHaveLength(1)
    expect(calls.melde[0]).toMatchObject({ aktion: 'einstellungen' }) // 401 → konfiguration
  })

  it('teilErfolg: Umschreib-Fehler legt den Rohtext in die Zwischenablage (nie einfügen) + protokolliert', async () => {
    const { sitzung, calls, protokollDaten } = makeSitzung({
      transcript: 'roher diktattext',
      rewriteFehler: new Error('KI-Fehler: kaputt')
    })

    await sitzung.starteWorkflow('improve', 'hotkey')
    await sitzung.stoppe()
    await tick() // protokolliere ist fire-and-forget

    expect(calls.einfügen).toEqual([])
    expect(calls.inZwischenablage).toEqual(['roher diktattext'])
    expect(calls.melde).toHaveLength(1)
    expect(protokollDaten).toHaveLength(1)
    expect(protokollDaten[0]).toMatchObject({
      rohtext: 'roher diktattext',
      endtext: 'roher diktattext',
      umgeschrieben: false
    })
  })

  it('A5: ein fehlschlagendes Protokoll-Schreiben reißt den Lauf NICHT herunter (Einfügen bleibt)', async () => {
    const { sitzung, calls } = makeSitzung({ transcript: 'hallo', protokollWirft: true })

    await sitzung.starteWorkflow('transcribe', 'hotkey')
    await expect(sitzung.stoppe()).resolves.toBeUndefined()
    await tick()

    // Das Einfügen erfolgte; der nachgelagerte Schreibfehler wurde geschluckt (kein Re-throw).
    expect(calls.einfügen).toEqual(['hallo'])
  })

  it('L1: key-loser lokaler Anbieter nimmt auch ohne Key auf (Gate lässt durch)', async () => {
    const { sitzung, recorder } = makeSitzung({
      hasKey: false,
      settings: {
        anbieter: [
          {
            id: 'lokal',
            vorlage: 'custom',
            label: 'Lokal',
            baseUrl: 'http://localhost:8000/v1',
            asrModell: 'whisper-1',
            chatModell: 'x',
            keinKeyNoetig: true
          }
        ],
        standardAnbieterId: 'lokal'
      }
    })

    await sitzung.starteWorkflow('transcribe', 'hotkey')
    expect(recorder.started).toBe(1)
  })
})
