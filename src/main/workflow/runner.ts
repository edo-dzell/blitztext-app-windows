// Zentraler Reducer eines Workflows: idle → aufnehmen → transkribieren → (umschreiben) → fertig | fehler.
// Treue Portierung der Orchestrierung aus den macOS-Workflow-Klassen (TranscriptionWorkflow,
// TextImprovementWorkflow, …). Alle Kollaborateure sind injizierte Ports → ohne echtes Netz/OS testbar.
//
// V2 (Strang C): Der Runner kennt keine festen Workflow-Ids mehr. Er bekommt die aufgelöste
// WorkflowDefinition (rewrites/promptModus/model/temperature) plus das Provider-Default-Chatmodell
// in der RunInput. Modell/Temperatur/Prompt kommen damit aus der Definition statt aus hartem Code —
// die vier eingebauten Workflows liefern über ihre Seeds exakt die alten Werte (Verhalten unverändert).

import type { WorkflowDefinition } from '@shared/workflows'
import type { TranscriptionProvider } from '@main/transcription/cloud-provider'
import type { RewriteProvider } from '@main/rewrite/cloud-provider'
import type { resolveSystemPrompt, RewriteSettings } from '@main/rewrite/prompt-builder'
import { kapsleTranskript, entferneTranskriptMarken } from '@main/rewrite/prompt-builder'

export interface RecordingResult {
  audio: Blob
  durationSeconds: number
}

/** Mikrofon-Aufnahme. Echte Implementierung (MediaRecorder) ist HITL/Windows; im Test ein Fake. */
export interface Recorder {
  start(): void
  stop(): Promise<RecordingResult>
  /** Aufnahme beenden und verwerfen, ohne ein Ergebnis zu liefern (Abbruch). */
  discard(): void
}

interface QualityPort {
  shouldRejectRecording(durationSeconds: number): boolean
  cleanedTranscript(text: string): string
  // rohtextAus säubert intern und prüft auf Artefakt — kein cleanedTranscript davor nötig.
  rohtextAus(raw: string, recordingSeconds: number): string | null
}

export interface WorkflowRunnerDeps {
  recorder: Recorder
  transcription: TranscriptionProvider
  rewrite: RewriteProvider
  resolveSystemPrompt: typeof resolveSystemPrompt
  quality: QualityPort
  /**
   * Watchdog-Backstop: startet einen Timer und ruft `onTimeout`, wenn ein Anbieter-Aufruf hängt;
   * gibt eine Abbruchfunktion zurück. Ohne Angabe: 90 s via setTimeout. Im Test injizierbar.
   */
  starteWatchdog?: (onTimeout: () => void) => () => void
}

export interface RunInput {
  /** Aufgelöste Workflow-Definition (rewrites/promptModus/model/temperature). */
  def: WorkflowDefinition
  /** Provider-Default-Chatmodell für def.model === '' (custom Workflows ohne eigenes Modell). */
  chatModell: string
  language?: string
  customTerms?: string[]
  rewriteSettings?: RewriteSettings
}

/**
 * Telemetrie des letzten abgeschlossenen Laufs (Strang D). Bewusst NICHT durch den Phasen-Kanal
 * geleitet (kein Leak sensibler Texte über die Status-Pille; Phasen bleiben byte-stabil). Die
 * Sitzung liest dies nach einem 'fertig' und ergänzt die Modellnamen aus der Provider-Config.
 */
export interface RunMetrik {
  workflowId: string
  dauerSekunden: number
  rohtext: string
  endtext: string
  usage?: { promptTokens: number; completionTokens: number }
  /** true, wenn ein Umschreibe-Schritt (Chat) lief — sonst reine Transkription. */
  umgeschrieben: boolean
}

// Art eines Fehlers — die zwei Ergebnisse, die der Runner wahrhaftig unterscheidet:
// 'aufnahme' = nichts Brauchbares aufgenommen (zu kurz / Artefakt, ein Urteil des Runners);
// 'anbieter' = ein Kollaborateur (Transkription/Umschreiben) hat geworfen.
// Feinere Kategorien (netzwerk/konfiguration) kommen mit ihrem UI-Konsumenten (Tray/Renderer).
export type FehlerArt = 'aufnahme' | 'anbieter'

export type WorkflowPhase =
  | { status: 'idle' }
  | { status: 'aufnehmen' }
  | { status: 'transkribieren' }
  | { status: 'umschreiben' }
  | { status: 'fertig'; text: string }
  | { status: 'fehler'; art: FehlerArt; message: string }

export interface WorkflowRunner {
  readonly phase: WorkflowPhase
  /** Telemetrie des letzten 'fertig'-Laufs (Strang D); null, solange keiner abgeschlossen ist. */
  readonly letzteMetrik: RunMetrik | null
  onPhase?: (phase: WorkflowPhase) => void
  start(input: RunInput): void
  stop(): Promise<WorkflowPhase>
  /** Abbruch in Aufnahme/Transkription/Umschreiben: bricht laufende Anbieter-Aufrufe ab, still nach idle. */
  abbrechen(): void
}

// Beide Aufnahme-Guards (zu kurz / Artefakt) melden denselben Text wie das macOS-Original.
const NO_RECORDING_ERROR = 'Keine Aufnahme erkannt.'

export function createWorkflowRunner(deps: WorkflowRunnerDeps): WorkflowRunner {
  let phase: WorkflowPhase = { status: 'idle' }
  let input: RunInput | null = null
  let letzteMetrik: RunMetrik | null = null
  // Abbruch-Steuerung pro Lauf: Controller bricht die in-flight fetch ab; `abgebrochen` markiert einen
  // manuellen Abbruch, damit der Catch still nach idle führt statt einen Fehler zu melden.
  let controller: AbortController | null = null
  let abgebrochen = false

  const starteWatchdog =
    deps.starteWatchdog ??
    ((onTimeout: () => void) => {
      const t = setTimeout(onTimeout, 90_000)
      return () => clearTimeout(t)
    })

  const runner: WorkflowRunner = {
    get phase() {
      return phase
    },
    get letzteMetrik() {
      return letzteMetrik
    },
    start(next) {
      input = next
      abgebrochen = false
      transition({ status: 'aufnehmen' })
      deps.recorder.start()
    },
    abbrechen() {
      // Wirkt in Aufnahme, Transkription und Umschreiben; in Terminal-/Leerlauf-Phasen ein No-Op.
      if (
        phase.status !== 'aufnehmen' &&
        phase.status !== 'transkribieren' &&
        phase.status !== 'umschreiben'
      ) {
        return
      }
      abgebrochen = true
      if (phase.status === 'aufnehmen') {
        deps.recorder.discard()
      } else {
        controller?.abort(new DOMException('Abbruch durch Nutzer.', 'AbortError'))
      }
      transition({ status: 'idle' })
    },
    async stop() {
      // Phantom-Stop-Schutz: stop() ist nur in der Aufnahme-Phase sinnvoll. Wird es ohne laufende
      // Aufnahme aufgerufen (Dispatcher/Sitzung-Desync bei langem Umschreiben: ein verworfener
      // zweiter Start hinterlässt im Dispatcher einen „aktiven" Chord, dessen Loslassen einen Stop
      // ohne Aufnahme auslöst), no-op statt einen zweiten recorder.stop() abzusetzen — der sonst im
      // Renderer 'Keine aktive Aufnahme' wirft → ungefangene Ablehnung → blockierender Fehlerdialog.
      if (phase.status !== 'aufnehmen') return phase

      let recording: RecordingResult
      try {
        recording = await deps.recorder.stop()
      } catch (err) {
        // Recorder-Fehler sauber als 'fehler' melden statt als uncaught exception durchzureichen.
        // Manueller Abbruch (discard → AbortError) ist bereits nach idle gegangen → still bleiben.
        if (abgebrochen) return phase
        const message = err instanceof Error ? err.message : String(err)
        return transition({ status: 'fehler', art: 'aufnahme', message })
      }
      if (deps.quality.shouldRejectRecording(recording.durationSeconds)) {
        return transition({ status: 'fehler', art: 'aufnahme', message: NO_RECORDING_ERROR })
      }

      abgebrochen = false
      controller = new AbortController()
      let istTimeout = false
      const stoppeWatchdog = starteWatchdog(() => {
        istTimeout = true
        controller?.abort(new DOMException('Zeitüberschreitung beim Anbieter.', 'TimeoutError'))
      })

      try {
        transition({ status: 'transkribieren' })
        // Eigennamen nur bei ausreichend langer Aufnahme mitschicken (≥ 0,9 s), wie im Original.
        const vocabularyHints = recording.durationSeconds >= 0.9 ? input?.customTerms ?? [] : []
        const raw = await deps.transcription.transcribe(recording.audio, {
          language: input?.language,
          vocabularyHints,
          signal: controller.signal
        })
        const rohtext = deps.quality.rohtextAus(raw, recording.durationSeconds)
        if (rohtext === null) {
          return transition({ status: 'fehler', art: 'aufnahme', message: NO_RECORDING_ERROR })
        }

        const def = input?.def
        if (!def || !def.rewrites) {
          return abschluss(rohtext, rohtext, recording.durationSeconds, undefined, false)
        }

        transition({ status: 'umschreiben' })
        const system = deps.resolveSystemPrompt(def, input?.rewriteSettings)
        // 0.3.1-Blocker-Fix: das bereits AUFGELÖSTE chatModell (aus aufloeseWorkflowLauf →
        // aufgeloestesChatModell, inkl. Fremd-Modell-Fallback) ist die alleinige Wahrheitsquelle.
        // NICHT mehr def.model bevorzugen — sonst ginge ein gepinntes OpenAI-Modell (Built-ins) gegen
        // Mistral/Groq und stürzte ab. Der def.model-Vorrang steckt bereits korrekt in chatModell.
        const model = input?.chatModell ?? ''
        // Rohtext gekapselt senden (Daten-Rahmen, prompt-builder): zieht die Grenze „zu bearbeitende
        // Daten" vs. „Anweisung", damit ein direkt ansprechendes Diktat nicht als Befehl befolgt wird.
        const rewritten = await deps.rewrite.rewrite(
          { system, user: kapsleTranskript(rohtext) },
          { model, temperature: def.temperature, signal: controller.signal }
        )
        // Etwaig zurückgespiegelte Markierungen entfernen, bevor cleanedTranscript trimmt.
        const endtext = deps.quality.cleanedTranscript(entferneTranskriptMarken(rewritten.text))
        return abschluss(rohtext, endtext, recording.durationSeconds, rewritten.usage, true)
      } catch (err) {
        // Manueller Abbruch: still nach idle (bereits durch abbrechen() gesetzt) — kein Fehler/Metrik.
        if (abgebrochen) return phase
        const istTimeoutFehler =
          istTimeout || (err instanceof Error && err.name === 'TimeoutError')
        const message = istTimeoutFehler
          ? 'Zeitüberschreitung beim Anbieter.'
          : err instanceof Error
            ? err.message
            : String(err)
        return transition({ status: 'fehler', art: 'anbieter', message })
      } finally {
        stoppeWatchdog()
      }
    }
  }

  // Setzt die Telemetrie des Laufs und geht nach 'fertig'. rohtext/endtext bleiben hier (Verlauf);
  // die Phase trägt NUR den Endtext (kein rohtext-Leak über den Status-Kanal).
  function abschluss(
    rohtext: string,
    endtext: string,
    dauerSekunden: number,
    usage: RunMetrik['usage'],
    umgeschrieben: boolean
  ): WorkflowPhase {
    letzteMetrik = {
      workflowId: input?.def.id ?? '',
      dauerSekunden,
      rohtext,
      endtext,
      usage,
      umgeschrieben
    }
    return transition({ status: 'fertig', text: endtext })
  }

  function transition(next: WorkflowPhase): WorkflowPhase {
    phase = next
    runner.onPhase?.(next)
    return next
  }

  return runner
}
