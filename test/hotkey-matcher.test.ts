import { describe, it, expect } from 'vitest'
import { createHotkeyMatcher } from '@main/hotkey/matcher'

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
