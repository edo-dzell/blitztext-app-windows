// Fokusfreies Status-Fenster (#08/#11, HITL/Windows): zeigt Aufnahme-/Ergebnis-Status an, OHNE dem
// Paste-Ziel den Fokus zu stehlen — sonst bliebe das Vordergrundfenster nicht das Einfüge-Ziel
// (Bezug ADR-0003). Schlüssel: focusable:false + showInactive(). Inhalt/Layout der Statusanzeige
// werden auf Windows visuell finalisiert; hier steht die fokussichere Primitive.

import { BrowserWindow } from 'electron'

export function createFokusfreiesFenster(): BrowserWindow {
  return new BrowserWindow({
    width: 320,
    height: 96,
    show: false,
    focusable: false, // kann keinen Tastaturfokus erhalten
    skipTaskbar: true,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    webPreferences: { sandbox: false }
  })
}

/** Anzeigen, ohne zu aktivieren (kein Fokus-Diebstahl). */
export function zeigeOhneFokus(fenster: BrowserWindow): void {
  fenster.showInactive()
}
