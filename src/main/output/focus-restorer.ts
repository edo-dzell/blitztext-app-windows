// R4/#28 — SPIKE (research-gated, ADR-0011, NOCH NICHT verdrahtet): node-testbare Ablauflogik der
// Fokus-Rückkehr vor dem Einfügen. Der eigentliche OS-Effekt (GetForegroundWindow / IsWindow /
// SetForegroundWindow / SendInput Strg+V) liegt hinter einem injizierten Port → in Tests gemockt,
// real bevorzugt per PowerShell via child_process (keine neue npm-Dep, kein node-gyp; siehe ADR-0011).
// Diese Datei ändert das Laufzeitverhalten NICHT (kein Aufrufer); sie bereitet R4 vor.

export interface FensterEffekt {
  /** Aktuelles Vordergrundfenster-Handle merken (vor dem Zeigen eigener Fenster). null = unbekannt. */
  aktuellesVordergrundfenster(): number | null
  /** Ist das Handle noch ein gültiges, lebendes Fenster? (IsWindow-Guard gegen Stale-HWND) */
  istFenster(hwnd: number): boolean
  /** Fokus auf das Handle zurückgeben (SetForegroundWindow + ALT-Tap-Fallback). */
  fokussiere(hwnd: number): void
  /** Einfügen auslösen (SendInput Strg+V). */
  einfuegen(): void
}

export interface FocusRestorer {
  /** Vor dem Anzeigen eigener UI das Zielfenster merken. */
  merke(): void
  /** Fokus zum gemerkten Fenster zurückgeben (falls noch gültig) und einfügen. true = ausgeführt. */
  stelleHerUndFuegeEin(): boolean
}

export function createFocusRestorer(effekt: FensterEffekt): FocusRestorer {
  let ziel: number | null = null
  return {
    merke() {
      ziel = effekt.aktuellesVordergrundfenster()
    },
    stelleHerUndFuegeEin() {
      // Ungültiges/fehlendes Ziel → NICHT einfügen (lieber nichts als ins falsche Fenster).
      if (ziel === null || !effekt.istFenster(ziel)) return false
      effekt.fokussiere(ziel)
      effekt.einfuegen()
      return true
    }
  }
}
