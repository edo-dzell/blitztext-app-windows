import { describe, it, expect } from 'vitest'
import { validateChord } from '@shared/validate-chord'

const leer = { belegung: {}, ziel: 'transcribe' as const }

describe('validateChord — interne Konflikte (hart)', () => {
  it('exakte Gleichheit mit anderem Workflow → harter Konflikt', () => {
    const u = validateChord(['ControlRight', 'ShiftRight', 'Digit2'], {
      belegung: { improve: ['ControlRight', 'ShiftRight', 'Digit2'] },
      ziel: 'calm'
    })
    expect(u.hart.some((k) => k.art === 'intern' && k.workflow === 'improve')).toBe(true)
  })

  it('Teilmenge eines anderen Chords → harter Konflikt (Dispatcher-Regel)', () => {
    const u = validateChord(['ControlRight', 'ShiftRight'], {
      belegung: { improve: ['ControlRight', 'ShiftRight', 'Digit2'] },
      ziel: 'calm'
    })
    expect(u.hart.some((k) => k.art === 'intern')).toBe(true)
  })

  it('eigener Workflow (ziel) wird vom Eigenvergleich ausgenommen', () => {
    const u = validateChord(['ControlRight', 'ShiftRight', 'Digit2'], {
      belegung: { improve: ['ControlRight', 'ShiftRight', 'Digit2'] },
      ziel: 'improve'
    })
    expect(u.hart.some((k) => k.art === 'intern')).toBe(false)
  })
})

describe('validateChord — externe Klassen', () => {
  it('AltGr (Strg+Alt) → hart', () => {
    const u = validateChord(['ControlLeft', 'AltLeft', 'KeyQ'], leer)
    expect(u.hart.some((k) => k.art === 'altgr')).toBe(true)
  })

  it('RechtsAlt allein im Chord (= AltGr-Hälfte) → hart', () => {
    const u = validateChord(['AltRight', 'KeyE'], leer)
    expect(u.hart.some((k) => k.art === 'altgr')).toBe(true)
  })

  it('einzelne druckbare Taste ohne Nicht-Shift-Modifier → tippt-zeichen, hart', () => {
    expect(validateChord(['KeyA'], leer).hart.some((k) => k.art === 'tippt-zeichen')).toBe(true)
    expect(
      validateChord(['ShiftLeft', 'KeyA'], leer).hart.some((k) => k.art === 'tippt-zeichen')
    ).toBe(true)
  })

  it('Win + echte Taste (z. B. Win+L) → OS-reserviert, hart', () => {
    const u = validateChord(['MetaLeft', 'KeyL'], leer)
    expect(u.hart.some((k) => k.art === 'os-reserviert')).toBe(true)
  })

  it('System-Kombi (Alt+F4) → OS-reserviert, hart', () => {
    const u = validateChord(['AltLeft', 'F4'], leer)
    expect(u.hart.some((k) => k.art === 'os-reserviert')).toBe(true)
  })

  it('Strg+Win (nur Modifier) → WEICHE Startmenü-Warnung, nicht hart', () => {
    const u = validateChord(['ControlLeft', 'MetaLeft'], leer)
    expect(u.hart.some((k) => k.art === 'os-reserviert')).toBe(false)
    expect(u.weich.some((k) => k.art === 'os-reserviert')).toBe(true)
  })

  it('berühmter App-Shortcut (Strg+K) → weiche Warnung', () => {
    const u = validateChord(['ControlRight', 'KeyK'], leer)
    expect(u.weich.some((k) => k.art === 'app-shortcut')).toBe(true)
  })
})

describe('validateChord — sauberer Chord', () => {
  it('RechtsStrg+RechtsShift+Digit2 → keine bekannten Konflikte', () => {
    const u = validateChord(['ControlRight', 'ShiftRight', 'Digit2'], {
      belegung: { transcribe: ['ControlLeft', 'MetaLeft'] },
      ziel: 'improve'
    })
    expect(u.hart).toHaveLength(0)
    expect(u.weich).toHaveLength(0)
    expect(u.bekannteKonflikte).toBe(false)
  })
})
