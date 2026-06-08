// Ausgabe-Adapter (#04/#11, HITL/Windows): implementiert den Ausgabe-Port der Sitzung.
// - einfügen: Zwischenablage setzen → paste-service (win-paste.exe via winPastePfad → PowerShell-
//   SendKeys → nur-Zwischenablage+Hinweis) → bei Erfolg VERZÖGERTES, marker-geschütztes Restore
//   (RESEARCH §4: kein Sofort-Restore wegen Race; 1,5 s wie macOS). Port bleibt synchron `void`
//   (RESEARCH §4 Naht-Mismatch) — der Adapter besitzt das Async.
// - anzeigen / zeigeEinstellungen: an die Fenster-Schicht (index.ts) delegiert.
// Nicht headless verifizierbar (Electron clipboard + spawn) — Laufzeit-Abnahme auf Windows.

import { app, clipboard } from 'electron'
import { spawn } from 'node:child_process'
import {
  createPasteService,
  type EinfügeStrategie,
  type Zwischenablage
} from '@main/output/paste-service'
import { winPastePfad } from '@main/output/win-paste-path'
import type { Ausgabe } from '@main/session/sitzung'
import type { FehlerMeldung } from '@main/session/fehler-meldung'

// macOS nutzt 1,5 s Delay vor dem Restore (restorePasteboardIfCurrent); RESEARCH §4.
const RESTORE_DELAY_MS = 1500

/** Fenster-/Hinweis-Operationen, die der Adapter nicht selbst besitzt (von index.ts gestellt). */
export interface AusgabeFenster {
  anzeigen(text: string): void
  zeigeEinstellungen(): void
  /** „In Zwischenablage kopiert — bitte mit Strg+V einfügen." */
  zeigeManuellenHinweis(): void
  /** Einen fehlgeschlagenen Lauf melden (Notification; bei aktion 'einstellungen' mit Sprung). */
  melde(fehler: FehlerMeldung): void
}

export interface PasteAusgabeDeps {
  fenster: AusgabeFenster
  /** Pfad zu win-paste.exe; Default via winPastePfad aus app. Injizierbar für Tests/Sonderfälle. */
  helferPfad?: string
  /** Injizierbar für Tests; Default: node:child_process spawn. */
  spawnFn?: typeof spawn
  /** Verzögerung; injizierbar für Tests. */
  delayMs?: number
}

function defaultHelferPfad(): string {
  return winPastePfad({
    istVerpackt: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPfad: app.getAppPath()
  })
}

/** Prozess starten und auf Exit-Code 0 als Erfolg prüfen; Spawn-Fehler (ENOENT) → false. */
function prozessErfolg(spawnFn: typeof spawn, command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const kind = spawnFn(command, args, { windowsHide: true })
      kind.once('error', () => resolve(false))
      kind.once('exit', (code) => resolve(code === 0))
    } catch {
      resolve(false)
    }
  })
}

export function createPasteAusgabe(deps: PasteAusgabeDeps): Ausgabe {
  const spawnFn = deps.spawnFn ?? spawn
  const delayMs = deps.delayMs ?? RESTORE_DELAY_MS

  const zwischenablage: Zwischenablage = {
    lies: () => clipboard.readText(),
    schreib: (text) => clipboard.writeText(text)
  }

  const strategien: EinfügeStrategie[] = [
    {
      name: 'helfer',
      versuch: () => prozessErfolg(spawnFn, deps.helferPfad ?? defaultHelferPfad(), [])
    },
    {
      name: 'powershell',
      // Abhängigkeitsfreier Fallback (ADR-0003): SendKeys('^v') ins Vordergrundfenster.
      versuch: () =>
        prozessErfolg(spawnFn, 'powershell', [
          '-NoProfile',
          '-Command',
          "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"
        ])
    }
  ]

  const pasteService = createPasteService({
    zwischenablage,
    strategien,
    zeigeManuellenHinweis: () => deps.fenster.zeigeManuellenHinweis()
  })

  return {
    einfügen(text) {
      // Fire-and-forget: der Port ist synchron `void`, das Async lebt hier.
      void (async () => {
        const ergebnis = await pasteService.einfügen(text)
        if (ergebnis.erfolg) {
          // Verzögert + marker-geschützt (Guard steckt im Thunk): erst zurücksetzen, wenn das Ziel
          // unser Strg+V wirklich verarbeitet hat — sonst Race (RESEARCH §4).
          setTimeout(() => ergebnis.wiederherstellen(), delayMs)
        }
        // Bei Total-Fehlschlag bleibt der Text bewusst in der Zwischenablage (Hinweis kam schon).
      })().catch((err) => console.error('Einfügen fehlgeschlagen (ignoriert):', err))
    },
    anzeigen: (text) => deps.fenster.anzeigen(text),
    zeigeEinstellungen: () => deps.fenster.zeigeEinstellungen(),
    melde: (fehler) => deps.fenster.melde(fehler),
    // Teil-Erfolg: Rohtext in die Zwischenablage legen und liegen lassen (kein Restore — der Nutzer fügt
    // selbst mit Strg+V ein). Bewusst KEIN Auto-Paste.
    inZwischenablage: (text) => zwischenablage.schreib(text)
  }
}
