// Fokus-Rückkehr vor dem Einfügen (ADR-0011, F-1) — die testbare TS-Seite. Das HWND-Erfassen und das
// eigentliche SetForegroundWindow passieren nativ im win-paste.exe (HITL/Windows, #28). Hier liegt nur
// die reine Drift-Entscheidung: NUR restaurieren, wenn das Feature an ist UND der Fokus tatsächlich vom
// erfassten Paste-Ziel weggewandert ist (sonst wie bisher einfügen — kein synthetisches ALT im Normalfall).

export interface FokusEntscheidung {
  /** Soll der native Helfer das erfasste Fenster vor dem Paste aktiv zurückholen? */
  restauriere: boolean
  /** Das zurückzuholende Fenster-Handle (nur gesetzt, wenn restauriere=true). */
  hwnd: number | null
}

export function entscheideFokusRueckkehr(input: {
  /** Feature-Schalter (Default an). */
  aktiviert: boolean
  /** Vordergrund-Handle beim Aufnahme-Start (nativ erfasst); null = nichts erfasst. */
  erfasstesHwnd: number | null
  /** Aktuelles Vordergrund-Handle unmittelbar vor dem Einfügen. */
  aktuellesHwnd: number | null
}): FokusEntscheidung {
  const aus: FokusEntscheidung = { restauriere: false, hwnd: null }
  if (!input.aktiviert) return aus
  if (input.erfasstesHwnd === null) return aus
  // Kein Drift: das ursprüngliche Ziel hat noch den Fokus → wie bisher einfügen.
  if (input.aktuellesHwnd === input.erfasstesHwnd) return aus
  return { restauriere: true, hwnd: input.erfasstesHwnd }
}
