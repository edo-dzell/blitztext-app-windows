import { describe, it, expect } from 'vitest'
import {
  normalisiereChord,
  istAltGr,
  istVollstaendig,
  chordLabel,
  istModifierCode
} from '@renderer/lib/hotkey-capture'

describe('hotkey-capture', () => {
  it('normalisiert in kanonische Reihenfolge (Modifier zuerst)', () => {
    expect(normalisiereChord(['Digit2', 'ShiftRight', 'ControlRight'])).toEqual([
      'ControlRight',
      'ShiftRight',
      'Digit2'
    ])
  })

  it('entfernt Duplikate', () => {
    expect(normalisiereChord(['ControlLeft', 'ControlLeft', 'KeyA'])).toEqual([
      'ControlLeft',
      'KeyA'
    ])
  })

  it('istModifierCode erkennt Modifier', () => {
    expect(istModifierCode('MetaLeft')).toBe(true)
    expect(istModifierCode('KeyA')).toBe(false)
  })

  it('istAltGr nutzt getModifierState(AltGraph)', () => {
    expect(istAltGr({ getModifierState: (k) => k === 'AltGraph' })).toBe(true)
    expect(istAltGr({ getModifierState: () => false })).toBe(false)
  })

  it('istVollstaendig: braucht eine echte Taste ODER ≥2 Modifier', () => {
    expect(istVollstaendig(['ControlLeft'])).toBe(false)
    expect(istVollstaendig(['ControlLeft', 'MetaLeft'])).toBe(true)
    expect(istVollstaendig(['ControlRight', 'ShiftRight', 'Digit2'])).toBe(true)
    expect(istVollstaendig(['KeyA'])).toBe(true)
  })

  it('chordLabel liefert lesbare Namen', () => {
    expect(chordLabel(['ControlLeft', 'MetaLeft'])).toBe('Strg (links) + Win (links)')
    expect(chordLabel(['ControlRight', 'ShiftRight', 'Digit2'])).toBe(
      'Strg (rechts) + Umschalt (rechts) + 2'
    )
  })
})
