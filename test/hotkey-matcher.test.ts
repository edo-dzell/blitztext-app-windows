import { describe, it, expect } from 'vitest'
import { createHotkeyMatcher, type ModifierLage } from '@main/hotkey/matcher'

const maske = (teile: Partial<ModifierLage> = {}): ModifierLage => ({
  ctrl: false,
  alt: false,
  shift: false,
  meta: false,
  ...teile
})

describe('createHotkeyMatcher', () => {
  it('hold: Chord komplettieren → start, eine Chord-Taste loslassen → stop', () => {
    const m = createHotkeyMatcher({ chord: ['Control', 'Space'], mode: 'hold' })

    expect(m.handle({ type: 'down', key: 'Control' })).toBeNull()
    expect(m.handle({ type: 'down', key: 'Space' })).toBe('start')
    expect(m.handle({ type: 'up', key: 'Space' })).toBe('stop')
  })

  it('hold: stop bei der ersten fallenden Flanke unabhängig von der Loslassreihenfolge', () => {
    const m = createHotkeyMatcher({ chord: ['Control', 'Space'], mode: 'hold' })

    m.handle({ type: 'down', key: 'Control' })
    expect(m.handle({ type: 'down', key: 'Space' })).toBe('start')
    expect(m.handle({ type: 'up', key: 'Control' })).toBe('stop')
    expect(m.handle({ type: 'up', key: 'Space' })).toBeNull()
  })

  it('toggle: erstes Komplettieren startet, Loslassen tut nichts, erneutes Komplettieren stoppt', () => {
    const m = createHotkeyMatcher({ chord: ['Control', 'Space'], mode: 'toggle' })

    m.handle({ type: 'down', key: 'Control' })
    expect(m.handle({ type: 'down', key: 'Space' })).toBe('start')
    expect(m.handle({ type: 'up', key: 'Space' })).toBeNull()
    expect(m.handle({ type: 'up', key: 'Control' })).toBeNull()

    m.handle({ type: 'down', key: 'Control' })
    expect(m.handle({ type: 'down', key: 'Space' })).toBe('stop')
  })

  it('Escape bricht eine aktive Aufnahme ab (hold und toggle), im Leerlauf passiert nichts', () => {
    const hold = createHotkeyMatcher({ chord: ['Control'], mode: 'hold' })
    expect(hold.handle({ type: 'down', key: 'Escape' })).toBeNull() // Leerlauf
    expect(hold.handle({ type: 'down', key: 'Control' })).toBe('start')
    expect(hold.handle({ type: 'down', key: 'Escape' })).toBe('cancel')
    expect(hold.handle({ type: 'up', key: 'Control' })).toBeNull() // schon abgebrochen, kein stop

    const toggle = createHotkeyMatcher({ chord: ['Control'], mode: 'toggle' })
    expect(toggle.handle({ type: 'down', key: 'Control' })).toBe('start')
    expect(toggle.handle({ type: 'down', key: 'Escape' })).toBe('cancel')
  })

  it('ignoriert fremde Tasten und einen unvollständigen Chord', () => {
    const m = createHotkeyMatcher({ chord: ['Control', 'Space'], mode: 'hold' })

    expect(m.handle({ type: 'down', key: 'KeyA' })).toBeNull() // fremd
    expect(m.handle({ type: 'down', key: 'Control' })).toBeNull() // nur Teil des Chords
    expect(m.handle({ type: 'down', key: 'KeyB' })).toBeNull() // fremd, Chord weiterhin unvollständig
    expect(m.handle({ type: 'up', key: 'KeyA' })).toBeNull()
  })

  it('feuert keinen zweiten start solange aktiv (Key-Repeat und Zusatztasten)', () => {
    const m = createHotkeyMatcher({ chord: ['Control', 'Space'], mode: 'hold' })

    m.handle({ type: 'down', key: 'Control' })
    expect(m.handle({ type: 'down', key: 'Space' })).toBe('start')
    expect(m.handle({ type: 'down', key: 'Space' })).toBeNull() // uiohook-Auto-Repeat
    expect(m.handle({ type: 'down', key: 'Control' })).toBeNull() // Auto-Repeat der zweiten Taste
    expect(m.handle({ type: 'down', key: 'KeyA' })).toBeNull() // fremde Zusatztaste
  })
})

// Win+L/UAC/erhöhte Fenster verschlucken Keyups (RESEARCH §3, UIPI) — ohne Selbstheilung bleibt
// der Modifier für immer „gedrückt" und LinksStrg ALLEIN startet die Aufnahme (Bug v0.4.0).
describe('Selbstheilung: verlorene Keyups über die Modifier-Maske der Quelle', () => {
  it('heilt ein verlorenes Win-Keyup — Strg allein startet NICHT', () => {
    const m = createHotkeyMatcher({ chord: ['ControlLeft', 'MetaLeft'], mode: 'hold' })

    // Win gedrückt (z. B. Win+L); das Keyup passiert auf dem Secure Desktop und geht verloren:
    m.handle({ type: 'down', key: 'MetaLeft', modifiers: maske({ meta: true }) })
    // Minuten später: Strg allein (z. B. Strg+C) — die Maske meldet Meta als losgelassen.
    expect(m.handle({ type: 'down', key: 'ControlLeft', modifiers: maske({ ctrl: true }) })).toBeNull()
    expect(m.handle({ type: 'up', key: 'ControlLeft', modifiers: maske() })).toBeNull()

    // Der echte Chord funktioniert danach normal:
    m.handle({ type: 'down', key: 'MetaLeft', modifiers: maske({ meta: true }) })
    expect(
      m.handle({ type: 'down', key: 'ControlLeft', modifiers: maske({ ctrl: true, meta: true }) })
    ).toBe('start')
  })

  it('eine verwaiste Aufnahme (beide Keyups verloren) wird abgebrochen, nicht blind transkribiert', () => {
    const m = createHotkeyMatcher({ chord: ['ControlLeft', 'MetaLeft'], mode: 'hold' })
    m.handle({ type: 'down', key: 'MetaLeft', modifiers: maske({ meta: true }) })
    expect(
      m.handle({ type: 'down', key: 'ControlLeft', modifiers: maske({ ctrl: true, meta: true }) })
    ).toBe('start')

    // Sperre während der Aufnahme: beide Keyups verloren. Irgendeine spätere Taste räumt auf —
    // cancel statt stop, weil der Loslass-Zeitpunkt unbekannt ist (kein blindes Transkribieren).
    expect(m.handle({ type: 'down', key: 'KeyA', modifiers: maske() })).toBe('cancel')
    // danach Leerlauf: Strg allein startet nichts
    expect(m.handle({ type: 'down', key: 'ControlLeft', modifiers: maske({ ctrl: true }) })).toBeNull()
  })

  it('das echte Loslassen einer Chord-Taste bleibt ein stop, auch wenn die Maske zugleich stale Tasten räumt', () => {
    const m = createHotkeyMatcher({ chord: ['ControlLeft', 'MetaLeft'], mode: 'hold' })
    m.handle({ type: 'down', key: 'MetaLeft', modifiers: maske({ meta: true }) })
    m.handle({ type: 'down', key: 'ControlLeft', modifiers: maske({ ctrl: true, meta: true }) })

    // Win-Up ging verloren; der Nutzer lässt Strg ECHT los → normales stop (transkribieren).
    expect(m.handle({ type: 'up', key: 'ControlLeft', modifiers: maske() })).toBe('stop')
  })

  it('toggle: stale Meta löst keinen Start aus', () => {
    const m = createHotkeyMatcher({ chord: ['ControlLeft', 'MetaLeft'], mode: 'toggle' })
    m.handle({ type: 'down', key: 'MetaLeft', modifiers: maske({ meta: true }) })
    expect(m.handle({ type: 'down', key: 'ControlLeft', modifiers: maske({ ctrl: true }) })).toBeNull()
  })

  it('Ereignisse ohne Maske verhalten sich wie bisher (keine Heilung)', () => {
    const m = createHotkeyMatcher({ chord: ['ControlLeft', 'MetaLeft'], mode: 'hold' })
    m.handle({ type: 'down', key: 'MetaLeft' })
    expect(m.handle({ type: 'down', key: 'ControlLeft' })).toBe('start')
  })

  it('reset() leert Tasten-Tracking und Aktiv-Zustand', () => {
    const m = createHotkeyMatcher({ chord: ['ControlLeft', 'MetaLeft'], mode: 'hold' })
    m.handle({ type: 'down', key: 'MetaLeft' })
    m.reset()
    expect(m.handle({ type: 'down', key: 'ControlLeft' })).toBeNull()
  })
})
