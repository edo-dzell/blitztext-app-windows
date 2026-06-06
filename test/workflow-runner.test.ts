import { describe, it, expect } from 'vitest'
import { createWorkflowRunner, type WorkflowRunnerDeps } from '@main/workflow/runner'
import * as quality from '@main/transcription/quality'
import { resolveSystemPrompt, buildSystemPrompt } from '@main/rewrite/prompt-builder'
import { getWorkflow, BUILTIN_WORKFLOWS } from '@shared/workflows'

const audio = new Blob(['x'], { type: 'audio/webm' })

// Bequeme Auflösung einer eingebauten Definition für die RunInput.
const def = (id: string) => getWorkflow(id, BUILTIN_WORKFLOWS)

function fakeRecorder(durationSeconds: number) {
  return {
    start(): void {},
    async stop() {
      return { audio, durationSeconds }
    },
    discard(): void {}
  }
}

function makeDeps(overrides: Partial<WorkflowRunnerDeps> = {}): WorkflowRunnerDeps {
  return {
    recorder: fakeRecorder(1.5),
    transcription: { async transcribe() { return 'roh' } },
    rewrite: { async rewrite() { return { text: 'umgeschrieben' } } },
    resolveSystemPrompt,
    quality,
    ...overrides
  }
}

describe('createWorkflowRunner', () => {
  it('transcribe: start → aufnehmen, stop → fertig mit gesäubertem Rohtext, kein Umschreiben', async () => {
    let rewriteCalled = false
    const runner = createWorkflowRunner(
      makeDeps({
        transcription: { async transcribe() { return '  hallo welt  ' } },
        rewrite: {
          async rewrite() {
            rewriteCalled = true
            return { text: 'x' }
          }
        }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'gpt-4o-mini' })
    expect(runner.phase).toEqual({ status: 'aufnehmen' })

    const terminal = await runner.stop()
    expect(terminal).toEqual({ status: 'fertig', text: 'hallo welt' })
    expect(runner.phase).toEqual({ status: 'fertig', text: 'hallo welt' })
    expect(rewriteCalled).toBe(false)
  })

  it('Kurzaufnahme-Guard: zu kurze Aufnahme → fehler, Transkription wird nicht aufgerufen', async () => {
    let transcribeCalled = false
    const runner = createWorkflowRunner(
      makeDeps({
        recorder: fakeRecorder(0.2),
        transcription: {
          async transcribe() {
            transcribeCalled = true
            return 'x'
          }
        }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'gpt-4o-mini' })
    const terminal = await runner.stop()

    expect(terminal).toEqual({ status: 'fehler', art: 'aufnahme', message: 'Keine Aufnahme erkannt.' })
    expect(transcribeCalled).toBe(false)
  })

  it('Artefakt-Guard: kurze Aufnahme mit artefakt-verdächtigem Rohtext → fehler', async () => {
    // 0,4 s + ≥5 Wörter erfüllt isLikelyArtifact (recordingSeconds < 0,55).
    const runner = createWorkflowRunner(
      makeDeps({
        recorder: fakeRecorder(0.4),
        transcription: { async transcribe() { return 'ein zwei drei vier fünf' } }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'gpt-4o-mini' })
    const terminal = await runner.stop()

    expect(terminal).toEqual({ status: 'fehler', art: 'aufnahme', message: 'Keine Aufnahme erkannt.' })
  })

  it('Provider-Fehler: wirft die Transkription, geht der Runner mit deren Meldung nach fehler', async () => {
    const runner = createWorkflowRunner(
      makeDeps({
        transcription: {
          async transcribe() {
            throw new Error('OpenAI-Fehler: Rate limit erreicht')
          }
        }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'gpt-4o-mini' })
    const terminal = await runner.stop()

    expect(terminal).toEqual({
      status: 'fehler',
      art: 'anbieter',
      message: 'OpenAI-Fehler: Rate limit erreicht'
    })
  })

  it('improve: durchläuft umschreiben und ruft rewrite mit Rohtext, Prompt und Routing auf', async () => {
    const phases: string[] = []
    let rewriteInput: { system: string; user: string } | undefined
    let rewriteOpts: { model: string; temperature: number } | undefined
    const settings = { tone: 'formal' as const }

    const runner = createWorkflowRunner(
      makeDeps({
        transcription: { async transcribe() { return '  rohtext hier  ' } },
        rewrite: {
          async rewrite(input, opts) {
            rewriteInput = input
            rewriteOpts = opts
            return { text: '  fertige nachricht  ' }
          }
        }
      })
    )
    runner.onPhase = (p) => phases.push(p.status)

    runner.start({ def: def('improve'), chatModell: 'gpt-4o-mini', rewriteSettings: settings })
    const terminal = await runner.stop()

    expect(phases).toEqual(['aufnehmen', 'transkribieren', 'umschreiben', 'fertig'])
    expect(terminal).toEqual({ status: 'fertig', text: 'fertige nachricht' })
    expect(rewriteInput).toEqual({
      system: buildSystemPrompt('improve', settings),
      user: 'rohtext hier'
    })
    expect(rewriteOpts).toMatchObject({ model: 'gpt-4o-mini', temperature: 0.3 })
  })

  it('calm: routet das Umschreiben auf gpt-4o @ 0.4', async () => {
    let rewriteOpts: { model: string; temperature: number } | undefined
    const runner = createWorkflowRunner(
      makeDeps({
        rewrite: {
          async rewrite(_input, opts) {
            rewriteOpts = opts
            return { text: 'ruhig' }
          }
        }
      })
    )

    // 0.3.1: der Runner nutzt das AUFGELÖSTE chatModell (sitzung übergibt lauf.chatModell). Für calm
    // @OpenAI ist das 'gpt-4o' (gepinntes Modell, für OpenAI gültig) — Temperatur kommt aus def.
    runner.start({ def: def('calm'), chatModell: 'gpt-4o' })
    await runner.stop()

    expect(rewriteOpts).toMatchObject({ model: 'gpt-4o', temperature: 0.4 })
  })

  it('nutzt das aufgelöste chatModell statt des gepinnten def.model (Built-in gegen Mistral, 0.3.1)', async () => {
    let rewriteOpts: { model: string } | undefined
    const runner = createWorkflowRunner(
      makeDeps({
        rewrite: {
          async rewrite(_input, opts) {
            rewriteOpts = opts
            return { text: 'x' }
          }
        }
      })
    )
    // improve pinnt 'gpt-4o-mini' (OpenAI); gegen Mistral löst die Sitzung auf 'mistral-small-latest'
    // auf. Der Runner MUSS dieses nutzen — sonst ginge gpt-4o-mini an Mistral (Absturz, der Bug).
    runner.start({ def: def('improve'), chatModell: 'mistral-small-latest' })
    await runner.stop()
    expect(rewriteOpts?.model).toBe('mistral-small-latest')
  })

  it('vocabularyHints: ab 0,9 s Aufnahme werden customTerms an die Transkription übergeben', async () => {
    let options: { language?: string; vocabularyHints?: string[] } | undefined
    const runner = createWorkflowRunner(
      makeDeps({
        recorder: fakeRecorder(0.9),
        transcription: {
          async transcribe(_audio, opts) {
            options = opts
            return 'hallo'
          }
        }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'gpt-4o-mini', customTerms: ['Acme', 'Blitztext'] })
    await runner.stop()

    expect(options?.vocabularyHints).toEqual(['Acme', 'Blitztext'])
  })

  it('vocabularyHints: unter 0,9 s Aufnahme bleiben sie leer', async () => {
    let options: { language?: string; vocabularyHints?: string[] } | undefined
    const runner = createWorkflowRunner(
      makeDeps({
        recorder: fakeRecorder(0.6),
        transcription: {
          async transcribe(_audio, opts) {
            options = opts
            return 'hallo'
          }
        }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'gpt-4o-mini', customTerms: ['Acme'] })
    await runner.stop()

    expect(options?.vocabularyHints).toEqual([])
  })

  it('start() startet die Aufnahme über den Recorder', () => {
    let started = 0
    const runner = createWorkflowRunner(
      makeDeps({
        recorder: {
          start() {
            started++
          },
          async stop() {
            return { audio, durationSeconds: 1.5 }
          },
          discard() {}
        }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'gpt-4o-mini' })

    expect(started).toBe(1)
    expect(runner.phase).toEqual({ status: 'aufnehmen' })
  })

  it('abbrechen() verwirft eine laufende Aufnahme und geht nach idle', () => {
    let discarded = 0
    const runner = createWorkflowRunner(
      makeDeps({
        recorder: {
          start() {},
          async stop() {
            return { audio, durationSeconds: 1.5 }
          },
          discard() {
            discarded++
          }
        }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'gpt-4o-mini' })
    runner.abbrechen()

    expect(runner.phase).toEqual({ status: 'idle' })
    expect(discarded).toBe(1)
  })

  it('abbrechen() im Leerlauf tut nichts', () => {
    let discarded = 0
    const runner = createWorkflowRunner(
      makeDeps({
        recorder: {
          start() {},
          async stop() {
            return { audio, durationSeconds: 1.5 }
          },
          discard() {
            discarded++
          }
        }
      })
    )

    runner.abbrechen()

    expect(runner.phase).toEqual({ status: 'idle' })
    expect(discarded).toBe(0)
  })

  // --- v0.2.x #02: Abbruch in Anbieter-Phasen + Watchdog ---

  // Eine Transkription, die hängt, bis ihr Signal abgebrochen wird.
  function haengendeTranskription() {
    return {
      async transcribe(_audio: Blob, opts?: { signal?: AbortSignal }) {
        return await new Promise<string>((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
      }
    }
  }

  it('abbrechen() während der Transkription bricht den Anbieter-Aufruf ab und geht STILL nach idle', async () => {
    const runner = createWorkflowRunner(makeDeps({ transcription: haengendeTranskription() }))

    runner.start({ def: def('transcribe'), chatModell: 'm' })
    const stopP = runner.stop()
    await new Promise((r) => setTimeout(r, 0))
    expect(runner.phase).toEqual({ status: 'transkribieren' })

    runner.abbrechen()
    const terminal = await stopP

    expect(terminal).toEqual({ status: 'idle' })
    expect(runner.phase).toEqual({ status: 'idle' })
  })

  it('Watchdog-Timeout → fehler art anbieter mit Zeitüberschreitungs-Meldung', async () => {
    let fireWatchdog: () => void = () => {}
    const runner = createWorkflowRunner(
      makeDeps({
        transcription: haengendeTranskription(),
        starteWatchdog: (onTimeout) => {
          fireWatchdog = onTimeout
          return () => {}
        }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'm' })
    const stopP = runner.stop()
    await new Promise((r) => setTimeout(r, 0))
    fireWatchdog()
    const terminal = await stopP

    expect(terminal).toEqual({
      status: 'fehler',
      art: 'anbieter',
      message: 'Zeitüberschreitung beim Anbieter.'
    })
  })

  // --- Regression: Phantom-Stop-Schutz (Dispatcher/Sitzung-Desync bei langem Umschreiben) ---

  function zaehlenderRecorder(durationSeconds = 1.5) {
    const z = { starts: 0, stops: 0, discards: 0 }
    return {
      z,
      start(): void {
        z.starts++
      },
      async stop() {
        z.stops++
        return { audio, durationSeconds }
      },
      discard(): void {
        z.discards++
      }
    }
  }

  it('stop() ohne laufende Aufnahme (Phase ≠ aufnehmen) ist ein No-Op und ruft den Recorder NICHT', async () => {
    const rec = zaehlenderRecorder()
    const runner = createWorkflowRunner(makeDeps({ recorder: rec }))

    const terminal = await runner.stop() // nie gestartet → Phase idle

    expect(terminal).toEqual({ status: 'idle' })
    expect(rec.z.stops).toBe(0)
  })

  it('ein zweiter stop() nach Abschluss löst KEINEN weiteren recorder.stop() aus (Phantom-Stop)', async () => {
    const rec = zaehlenderRecorder()
    const runner = createWorkflowRunner(
      makeDeps({ recorder: rec, transcription: { async transcribe() { return 'hallo' } } })
    )

    runner.start({ def: def('transcribe'), chatModell: 'm' })
    const erst = await runner.stop()
    expect(erst.status).toBe('fertig')
    expect(rec.z.stops).toBe(1)

    // Desync: Phase ist 'fertig' → no-op, kein zweiter recorder.stop(), keine Zustandsänderung.
    const zweit = await runner.stop()
    expect(zweit).toEqual(erst)
    expect(rec.z.stops).toBe(1)
  })

  it('Recorder-Fehler beim Stoppen → fehler/aufnahme statt uncaught rejection', async () => {
    const runner = createWorkflowRunner(
      makeDeps({
        recorder: {
          start() {},
          async stop(): Promise<{ audio: Blob; durationSeconds: number }> {
            throw new Error('Keine aktive Aufnahme.')
          },
          discard() {}
        }
      })
    )

    runner.start({ def: def('transcribe'), chatModell: 'm' })
    const terminal = await runner.stop()

    expect(terminal).toEqual({ status: 'fehler', art: 'aufnahme', message: 'Keine aktive Aufnahme.' })
  })

  it('stoppt den Watchdog nach erfolgreichem Lauf', async () => {
    let cancelled = 0
    const runner = createWorkflowRunner(
      makeDeps({ starteWatchdog: () => () => { cancelled++ } })
    )

    runner.start({ def: def('transcribe'), chatModell: 'm' })
    await runner.stop()

    expect(cancelled).toBe(1)
  })
})
