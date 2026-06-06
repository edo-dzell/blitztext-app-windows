import { describe, it, expect } from 'vitest'
import { keycodeZuName } from '@main/hotkey/uiohook-keymap'

describe('keycodeZuName', () => {
  it('mappt die seitenspezifischen Modifier (links/rechts erhalten, RESEARCH §3)', () => {
    expect(keycodeZuName(0x001d)).toBe('ControlLeft')
    expect(keycodeZuName(0x0e1d)).toBe('ControlRight')
    expect(keycodeZuName(0x002a)).toBe('ShiftLeft')
    expect(keycodeZuName(0x0036)).toBe('ShiftRight')
    expect(keycodeZuName(0x0038)).toBe('AltLeft')
    expect(keycodeZuName(0x0e38)).toBe('AltRight') // = AltGr-Hälfte, in Defaults gemieden
  })

  it('mappt die Default-Chord-Tasten (transcribe/improve/calm/emoji)', () => {
    expect(keycodeZuName(0x0024)).toBe('KeyJ')
    expect(keycodeZuName(0x0025)).toBe('KeyK')
    expect(keycodeZuName(0x0026)).toBe('KeyL')
  })

  it('mappt Escape (fester Abbruch-Key des Matchers) und Space', () => {
    expect(keycodeZuName(0x0001)).toBe('Escape')
    expect(keycodeZuName(0x0039)).toBe('Space')
  })

  it('unbekannte Keycodes → null (werden ignoriert)', () => {
    expect(keycodeZuName(0xffff)).toBeNull()
  })
})
