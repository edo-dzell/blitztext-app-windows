// Reiner, duck-typed Guard fürs Senden an ein evtl. lazy/verstecktes/zerstörtes BrowserWindow
// (node-testbar ohne Electron). Das Dashboard-Fenster (settingsWindow) wird lazy erzeugt und beim
// Schließen zerstört → nacktes `?.send` fängt nur null, nicht „Object has been destroyed".

export interface SendbaresFenster {
  isDestroyed(): boolean
  webContents: {
    isDestroyed(): boolean
    send(channel: string, ...args: unknown[]): void
  }
}

/** Reihenfolge bindend: erst das Fenster prüfen, DANN webContents — sonst Zugriff auf Zerstörtes. */
export function canSend(win: SendbaresFenster | null | undefined): boolean {
  return !!win && !win.isDestroyed() && !!win.webContents && !win.webContents.isDestroyed()
}

/** Sicher an ein Fenster senden; no-op, wenn nicht sendbar. */
export function sendeAn(
  win: SendbaresFenster | null | undefined,
  channel: string,
  ...args: unknown[]
): void {
  if (canSend(win)) win!.webContents.send(channel, ...args)
}
