// Fallback-Orchestrierung fürs Einfügen ins Paste-Ziel (ADR-0003), reine Logik hinter injizierten
// Ports → ohne echtes OS testbar. Reihenfolge: nativer Helfer (win-paste.exe) → PowerShell-SendKeys
// → nur Zwischenablage + Hinweis. Die echten Strategien (spawn) und das verzögerte, marker-geschützte
// Wiederherstellen der Zwischenablage liegen im Adapter (HITL/Windows), nicht hier.

export interface Zwischenablage {
  lies(): string
  schreib(text: string): void
}

export interface EinfügeStrategie {
  name: 'helfer' | 'powershell'
  versuch: () => Promise<boolean>
}

export interface PasteServiceDeps {
  zwischenablage: Zwischenablage
  strategien: EinfügeStrategie[]
  /** "In Zwischenablage kopiert — bitte mit Strg+V einfügen", wenn alle Strategien scheitern. */
  zeigeManuellenHinweis: () => void
}

export type EinfügeErgebnis =
  | { erfolg: true; strategie: 'helfer' | 'powershell'; wiederherstellen: () => void }
  | { erfolg: false }

export interface PasteService {
  einfügen(text: string): Promise<EinfügeErgebnis>
}

export function createPasteService(deps: PasteServiceDeps): PasteService {
  return {
    async einfügen(text) {
      const vorher = deps.zwischenablage.lies()
      deps.zwischenablage.schreib(text)
      for (const strategie of deps.strategien) {
        if (await strategie.versuch()) {
          // Wiederherstellen ist eine Absicht: der Adapter ruft sie verzögert auf (nach dem Paste).
          // Inhalts-Guard: nur zurücksetzen, wenn die Zwischenablage noch unseren Text trägt —
          // sonst hätte der Nutzer zwischenzeitlich etwas kopiert (vgl. macOS Marker-Check).
          const wiederherstellen = (): void => {
            if (deps.zwischenablage.lies() === text) deps.zwischenablage.schreib(vorher)
          }
          return { erfolg: true, strategie: strategie.name, wiederherstellen }
        }
      }
      deps.zeigeManuellenHinweis()
      return { erfolg: false }
    }
  }
}
