// Reine Abbildung von libuiohook-Keycodes auf die abstrakten Tastennamen des Matchers
// (DOM-`code`-Stil, links/rechts erhalten — RESEARCH §3). So wirkt das AltGr-Verbot über die
// Default-Chords (RightCtrl-basiert), und der uiohook-Adapter bleibt eine dünne Hülle um diese
// Tabelle. Werte = libuiohook VC_*-Codes (set-1-Scancodes) / RESEARCH §3.
// Quellen: kwhat/libuiohook uiohook.h; SnosMe/uiohook-napi; keymanapp PR #14909.

// DOM-Name → uiohook-Keycode. Bewusst auf das Nötige beschränkt: Modifier (seitenspezifisch),
// Escape/Space/CapsLock, A–Z und 0–9 (für konfigurierbare Chords, #07). Erweiterbar bei Bedarf.
const NAME_ZU_KEYCODE: Record<string, number> = {
  // Modifier — seitenspezifisch (RESEARCH §3); NICHT die kollabierten ctrlKey-Booleans nutzen.
  ShiftLeft: 0x002a,
  ShiftRight: 0x0036,
  ControlLeft: 0x001d,
  ControlRight: 0x0e1d,
  AltLeft: 0x0038,
  AltRight: 0x0e38, // RightAlt = AltGr-Hälfte → in Default-Chords gemieden
  MetaLeft: 0x0e5b,
  MetaRight: 0x0e5c,
  CapsLock: 0x003a, // unter Windows nicht unterdrückbar → nicht als Default-Trigger
  Escape: 0x0001, // fester Abbruch-Key des Matchers
  Space: 0x0039,
  // Buchstaben (libuiohook VC_A…VC_Z)
  KeyA: 0x001e, KeyB: 0x0030, KeyC: 0x002e, KeyD: 0x0020, KeyE: 0x0012,
  KeyF: 0x0021, KeyG: 0x0022, KeyH: 0x0023, KeyI: 0x0017, KeyJ: 0x0024,
  KeyK: 0x0025, KeyL: 0x0026, KeyM: 0x0032, KeyN: 0x0031, KeyO: 0x0018,
  KeyP: 0x0019, KeyQ: 0x0010, KeyR: 0x0013, KeyS: 0x001f, KeyT: 0x0014,
  KeyU: 0x0016, KeyV: 0x002f, KeyW: 0x0011, KeyX: 0x002d, KeyY: 0x0015,
  KeyZ: 0x002c,
  // Ziffernreihe (libuiohook VC_1…VC_0)
  Digit1: 0x0002, Digit2: 0x0003, Digit3: 0x0004, Digit4: 0x0005, Digit5: 0x0006,
  Digit6: 0x0007, Digit7: 0x0008, Digit8: 0x0009, Digit9: 0x000a, Digit0: 0x000b
}

const KEYCODE_ZU_NAME: ReadonlyMap<number, string> = new Map(
  Object.entries(NAME_ZU_KEYCODE).map(([name, code]) => [code, name])
)

/** uiohook-Keycode → abstrakter Tastenname (DOM-`code`-Stil), oder null wenn ungemappt. */
export function keycodeZuName(keycode: number): string | null {
  return KEYCODE_ZU_NAME.get(keycode) ?? null
}
