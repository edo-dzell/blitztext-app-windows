// Die Sitzung (CONTEXT.md): app-langlebige zentrale Steuerung. Nimmt eine Auslösung
// (Workflow + Auslösequelle) entgegen, führt damit genau einen Workflow über den workflow-runner
// aus und routet das Ergebnis — bei Hotkey ins Einfügen, bei manueller Quelle in die Anzeige.
// Pendant zu macOS AppState, aber ohne UI/OS-Wissen: Ausgabe + Eingang liegen hinter Nähten.

import { findWorkflow, type WorkflowId } from '@shared/workflows'
import { aufloeseWorkflowLauf, type AnbieterKonfig } from '@shared/anbieter'
import type { WorkflowRunner, WorkflowPhase } from '@main/workflow/runner'
import type { SettingsStore } from '@main/settings/store'
import { fehlerMeldung, type FehlerMeldung } from '@main/session/fehler-meldung'

export type Auslösequelle = 'hotkey' | 'manuell'

/** Downstream-Naht: was die Sitzung mit dem Endtext tut. Adapter (win-paste/Fenster) sind HITL. */
export interface Ausgabe {
  einfügen(text: string): void
  anzeigen(text: string): void
  zeigeEinstellungen(): void
  /** Einen fehlgeschlagenen Lauf dem Nutzer melden (Hintergrund: Windows-Notification, OS-announced). */
  melde(fehler: FehlerMeldung): void
  /** Text in die Zwischenablage legen, OHNE einzufügen (Teil-Erfolg: Rohtext retten). */
  inZwischenablage(text: string): void
}

/** Abschluss-Daten eines fertigen Laufs für Verlauf + Statistik (Strang D). */
export interface Abschlussdaten {
  workflowId: string
  workflowLabel: string
  rohtext: string
  endtext: string
  dauerSekunden: number
  asrModell: string
  chatModell: string
  usage?: { promptTokens: number; completionTokens: number }
  umgeschrieben: boolean
}

/** Protokoll-Naht: zeichnet einen Abschluss auf. Der Adapter splittet in Verlauf (Text) + Stats
 *  (text-frei) und baut id/Zeitstempel. Optional — fehlt er, wird nichts aufgezeichnet. */
export interface Protokoll {
  /** Liefert true, wenn der VERLAUF tatsächlich geschrieben wurde (für das history:changed-Event, P5b). */
  aufzeichnen(daten: Abschlussdaten): Promise<boolean>
}

export interface SitzungDeps {
  runner: WorkflowRunner
  einstellungen: SettingsStore
  apiKeys: { has(anbieterId: string): Promise<boolean> }
  ausgabe: Ausgabe
  protokoll?: Protokoll
  /** Aktiviert den pro Lauf aufgelösten Anbieter (Composition setzt damit die Provider-Closure-Zelle). */
  aktiviereAnbieter?: (anbieter: AnbieterKonfig) => void
  /** Feuert NACH erfolgtem Verlauf-Schreiben (P5b) → Composition sendet `history:changed` ans Dashboard. */
  onHistoryChanged?: () => void
}

export interface Sitzung {
  starteWorkflow(workflow: WorkflowId, quelle: Auslösequelle): Promise<void>
  stoppe(): Promise<void>
  brichAb(): void
  /** true, solange ein Lauf aktiv ist (für den Live-Reconfigure-Guard der Komposition). */
  beschaeftigt(): boolean
  onStatus?: (phase: WorkflowPhase) => void
}

export function createSitzung(deps: SitzungDeps): Sitzung {
  let aktiveQuelle: Auslösequelle | null = null
  // Kontext des laufenden Workflows für das Protokoll beim Abschluss (Label + genutzte Modelle).
  let aktiverKontext: { label: string; asrModell: string; chatModell: string } | null = null

  const sitzung: Sitzung = {
    async starteWorkflow(workflow, quelle) {
      if (aktiveQuelle !== null) return // ein Lauf zur Zeit; während aktiv neue Auslösungen ignorieren
      const settings = await deps.einstellungen.load()
      // Workflow-Definition auflösen; unbekannte Id (z. B. verwaister Hotkey) → still abbrechen.
      const def = findWorkflow(workflow, settings.workflows)
      if (!def) {
        if (quelle === 'manuell') deps.ausgabe.zeigeEinstellungen()
        return
      }
      // Pro Lauf den Anbieter + die TATSÄCHLICH genutzten Modelle auflösen (ADR-0010).
      const lauf = aufloeseWorkflowLauf(def, {
        anbieter: settings.anbieter,
        standardAnbieterId: settings.standardAnbieterId,
        language: settings.language
      })
      // Gate: ohne Key des AUFGELÖSTEN Anbieters gar nicht erst aufnehmen (Cloud-only, ADR-0001).
      // L1: key-loser lokaler Anbieter braucht kein Gate; sonst ohne Key gar nicht erst aufnehmen.
      if (!lauf.anbieter.keinKeyNoetig && !(await deps.apiKeys.has(lauf.anbieter.id))) {
        if (quelle === 'manuell') deps.ausgabe.zeigeEinstellungen()
        return // Hotkey: still abbrechen
      }
      aktiveQuelle = quelle
      deps.aktiviereAnbieter?.(lauf.anbieter)
      aktiverKontext = {
        label: def.label,
        asrModell: lauf.asrModell,
        chatModell: lauf.chatModell
      }
      deps.runner.start({
        def,
        chatModell: lauf.chatModell,
        language: lauf.language,
        customTerms: settings.customTerms,
        rewriteSettings: settings
      })
    },
    async stoppe() {
      // Desync-Schutz: ohne aktiven Lauf ist nichts zu stoppen. Der Hotkey-Dispatcher arbitriert
      // „ein Workflow zur Zeit" unabhängig von der Sitzung; verwirft die Sitzung einen Start (weil
      // ein langes Umschreiben noch läuft), feuert das Loslassen jenes Chords trotzdem ein stop.
      // Dann hier no-op — sonst Phantom-recorder.stop() ('Keine aktive Aufnahme') + Doppel-Einfügen.
      if (aktiveQuelle === null) return
      const quelle = aktiveQuelle
      const kontext = aktiverKontext
      const terminal = await deps.runner.stop()
      aktiveQuelle = null
      aktiverKontext = null
      if (terminal.status === 'fertig') {
        if (quelle === 'hotkey') deps.ausgabe.einfügen(terminal.text)
        else deps.ausgabe.anzeigen(terminal.text)
        // Fire-and-forget: das Einfügen ist bereits erfolgt; das Protokoll schreibt asynchron und
        // feuert danach onHistoryChanged. stoppe() bleibt Promise<void> (Kontext als Closure-Arg).
        void protokolliere(kontext)
      } else if (terminal.status === 'teilErfolg') {
        // Teil-Erfolg: Transkription gelang, Umschreiben scheiterte → Rohtext in die Zwischenablage,
        // NIE auto-einfügen (bei De-Eskalation wäre der Originaltext das Gegenteil der Absicht).
        deps.ausgabe.inZwischenablage(terminal.rohtext)
        deps.ausgabe.melde({
          titel: 'Umschreiben fehlgeschlagen',
          koerper: 'Der Rohtext liegt in der Zwischenablage — mit Strg+V einfügen.'
        })
        void protokolliere(kontext)
      } else if (terminal.status === 'fehler') {
        deps.ausgabe.melde(fehlerMeldung(terminal.art, terminal.message))
      }
    },
    brichAb() {
      deps.runner.abbrechen()
      aktiveQuelle = null
      aktiverKontext = null
    },
    beschaeftigt() {
      return aktiveQuelle !== null
    }
  }

  // Telemetrie des Laufs (aus runner.letzteMetrik, NICHT aus der Phase) ans Protokoll geben. Feuert
  // onHistoryChanged GENAU DANN, wenn der Verlauf tatsächlich geschrieben wurde (P5b).
  async function protokolliere(kontext: typeof aktiverKontext): Promise<void> {
    // A5/REL-1: Der Nebeneffekt (Verlauf/Statistik schreiben) darf die App NIE herunterreißen. Ein
    // Schreibfehler (Platte voll, AV-/OneDrive-Lock auf history.bin) wird geschluckt + protokolliert —
    // das Einfügen ist da bereits erfolgt.
    try {
      if (!deps.protokoll || !kontext) return
      const m = deps.runner.letzteMetrik
      if (!m) return
      const geschrieben = await deps.protokoll.aufzeichnen({
        workflowId: m.workflowId,
        workflowLabel: kontext.label,
        rohtext: m.rohtext,
        endtext: m.endtext,
        dauerSekunden: m.dauerSekunden,
        asrModell: kontext.asrModell,
        chatModell: m.umgeschrieben ? kontext.chatModell : '',
        usage: m.usage,
        umgeschrieben: m.umgeschrieben
      })
      if (geschrieben) deps.onHistoryChanged?.()
    } catch (err) {
      console.error('Protokollieren fehlgeschlagen (ignoriert):', err)
    }
  }

  // Runner-Phasen nach außen reichen, damit Tray und Fenster den Status spiegeln können.
  deps.runner.onPhase = (phase) => sitzung.onStatus?.(phase)

  return sitzung
}
