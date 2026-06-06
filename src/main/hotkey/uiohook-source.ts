// uiohook-Ereignisquelle (#02/#11, HITL/Windows): globaler Tastatur-Hook → KeyEvents in die
// Composition (`verarbeiteTaste`). Dünne Hülle um uiohook-napi + die reine Keycode-Abbildung
// (uiohook-keymap). Key-Repeat muss hier NICHT entprellt werden — der Matcher ignoriert Repeats
// bereits (RESEARCH §3). Ungemappte Keycodes werden verworfen.
// Caveats (RESEARCH §3): Sticky Keys können ein Up verschlucken (→ Toggle-Modus als Ausweg),
// Vollbild-/elevated Apps können Hooks schlucken. Laufzeit-Abnahme auf Windows.

import { uIOhook, type UiohookKeyboardEvent } from 'uiohook-napi'
import { keycodeZuName } from '@main/hotkey/uiohook-keymap'
import type { KeyEvent } from '@main/hotkey/matcher'

/** Minimaler Hook-Vertrag (Teil von uIOhook) → injizierbar für Tests ohne nativen Hook. */
export interface UiohookQuelle {
  on(event: 'keydown' | 'keyup', listener: (e: UiohookKeyboardEvent) => void): unknown
  start(): void
  stop(): void
}

export interface UiohookQuelleDeps {
  verarbeiteTaste(event: KeyEvent): void
  /** Default: das uIOhook-Singleton; in Tests ein Fake. */
  hook?: UiohookQuelle
}

/** Startet den Hook und gibt einen Stopp-Thunk zurück (für app.will-quit). */
export function starteUiohookQuelle(deps: UiohookQuelleDeps): () => void {
  const hook = deps.hook ?? uIOhook
  const handler = (type: 'down' | 'up') => (e: UiohookKeyboardEvent): void => {
    const key = keycodeZuName(e.keycode)
    if (key) deps.verarbeiteTaste({ type, key })
  }
  hook.on('keydown', handler('down'))
  hook.on('keyup', handler('up'))
  // start() in try/catch: ein Fehler beim Laden des nativen Hooks darf den App-Start nicht killen
  // (uiohook-napi-Crash ist macOS-spezifisch, Windows unkritisch — RESEARCH §5).
  try {
    hook.start()
  } catch (err) {
    console.error('uiohook konnte nicht gestartet werden:', err)
    return () => {}
  }
  return () => {
    try {
      hook.stop()
    } catch {
      // bereits gestoppt / nie gestartet — ignorieren
    }
  }
}
