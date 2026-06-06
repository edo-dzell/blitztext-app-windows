// Reine Helfer fürs Einfangen einer Tastenkombination im Settings-UI (V2). `KeyboardEvent.code` ist
// layout-unabhängig und unterscheidet links/rechts (ControlLeft/MetaLeft/Digit2 …) — genau unser
// Chord-Format. AltGr feuert auf DE als ControlLeft+AltRight (RESEARCH §3) → erkennen und ablehnen.

const MODIFIER_REIHENFOLGE = [
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight'
]
const MODIFIER = new Set(MODIFIER_REIHENFOLGE)

export function istModifierCode(code: string): boolean {
  return MODIFIER.has(code)
}

/** Bringt die gedrückten Codes in eine stabile Reihenfolge: Modifier (kanonisch) zuerst, dann der Rest. */
export function normalisiereChord(codes: Iterable<string>): string[] {
  const eindeutig = Array.from(new Set(codes))
  const modifier = MODIFIER_REIHENFOLGE.filter((m) => eindeutig.includes(m))
  const rest = eindeutig.filter((c) => !MODIFIER.has(c)).sort()
  return [...modifier, ...rest]
}

/** AltGr aktiv? (DE: AltGr = Ctrl+AltRight; getModifierState('AltGraph') ist der verlässliche Test.) */
export function istAltGr(e: { getModifierState(key: string): boolean }): boolean {
  return e.getModifierState('AltGraph')
}

/** Hat der Chord mindestens eine Nicht-Modifier-Taste ODER mindestens zwei Modifier? (sonst unbrauchbar) */
export function istVollstaendig(chord: string[]): boolean {
  const nichtModifier = chord.filter((c) => !MODIFIER.has(c))
  const modifier = chord.filter((c) => MODIFIER.has(c))
  return nichtModifier.length > 0 || modifier.length >= 2
}

/** Lesbares Label für die Anzeige (z. B. ['ControlLeft','MetaLeft'] → 'Strg (links) + Win (links)'). */
export function chordLabel(chord: string[]): string {
  return chord.map(tasteLabel).join(' + ')
}

function tasteLabel(code: string): string {
  const map: Record<string, string> = {
    ControlLeft: 'Strg (links)',
    ControlRight: 'Strg (rechts)',
    MetaLeft: 'Win (links)',
    MetaRight: 'Win (rechts)',
    AltLeft: 'Alt',
    AltRight: 'AltGr',
    ShiftLeft: 'Umschalt (links)',
    ShiftRight: 'Umschalt (rechts)'
  }
  if (map[code]) return map[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}
