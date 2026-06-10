import { describe, it, expect } from 'vitest'
import { createHotkeyDispatcher } from '@main/hotkey/dispatcher'
import type { ModifierLage } from '@main/hotkey/matcher'

const maske = (teile: Partial<ModifierLage> = {}): ModifierLage => ({
  ctrl: false,
  alt: false,
  shift: false,
  meta: false,
  ...teile
})

// Zwei nicht-überlappende Chords → zwei Workflows.
const bindungen = [
  { chord: ['ControlRight', 'KeyJ'], workflow: 'improve' as const },
  { chord: ['ControlRight', 'KeyK'], workflow: 'calm' as const }
]

describe('createHotkeyDispatcher', () => {
  it('hold: Chord komplettieren → start des zugehörigen Workflows, loslassen → stop', () => {
    const d = createHotkeyDispatcher({ bindungen, mode: 'hold' })

    expect(d.handle({ type: 'down', key: 'ControlRight' })).toBeNull()
    expect(d.handle({ type: 'down', key: 'KeyJ' })).toEqual({ aktion: 'start', workflow: 'improve' })
    expect(d.handle({ type: 'up', key: 'KeyJ' })).toEqual({ aktion: 'stop', workflow: 'improve' })
  })

  it('dispatcht je Chord den eigenen Workflow', () => {
    const d = createHotkeyDispatcher({ bindungen, mode: 'hold' })
    d.handle({ type: 'down', key: 'ControlRight' })
    expect(d.handle({ type: 'down', key: 'KeyK' })).toEqual({ aktion: 'start', workflow: 'calm' })
  })

  it('ignoriert einen zweiten Chord, solange ein Workflow aktiv ist', () => {
    const d = createHotkeyDispatcher({ bindungen, mode: 'hold' })
    d.handle({ type: 'down', key: 'ControlRight' })
    expect(d.handle({ type: 'down', key: 'KeyJ' })).toEqual({ aktion: 'start', workflow: 'improve' })
    // improve aktiv → der calm-Chord wird ignoriert
    expect(d.handle({ type: 'down', key: 'KeyK' })).toBeNull()
  })

  it('Escape bricht den aktiven Workflow ab und gibt den Dispatcher wieder frei', () => {
    const d = createHotkeyDispatcher({ bindungen, mode: 'hold' })
    d.handle({ type: 'down', key: 'ControlRight' })
    d.handle({ type: 'down', key: 'KeyJ' })
    expect(d.handle({ type: 'down', key: 'Escape' })).toEqual({ aktion: 'cancel', workflow: 'improve' })
    // wieder frei: ControlRight noch gehalten, KeyK komplettiert → calm startet
    d.handle({ type: 'up', key: 'KeyJ' })
    expect(d.handle({ type: 'down', key: 'KeyK' })).toEqual({ aktion: 'start', workflow: 'calm' })
  })

  it('toggle: erstes Komplettieren startet, erneutes stoppt', () => {
    const d = createHotkeyDispatcher({ bindungen, mode: 'toggle' })
    d.handle({ type: 'down', key: 'ControlRight' })
    expect(d.handle({ type: 'down', key: 'KeyJ' })).toEqual({ aktion: 'start', workflow: 'improve' })
    d.handle({ type: 'up', key: 'KeyJ' })
    expect(d.handle({ type: 'down', key: 'KeyJ' })).toEqual({ aktion: 'stop', workflow: 'improve' })
  })

  it('ignoriert fremde Tasten', () => {
    const d = createHotkeyDispatcher({ bindungen, mode: 'hold' })
    expect(d.handle({ type: 'down', key: 'KeyA' })).toBeNull()
    expect(d.handle({ type: 'down', key: 'ControlLeft' })).toBeNull()
  })
})

// Bug v0.4.0: verlorenes Win-Keyup (Win+L/UAC/erhöhtes Fenster) → transcribe startete bei
// LinksStrg allein. Heilung über die Modifier-Maske + expliziter Reset (powerMonitor).
describe('Selbstheilung & Reset', () => {
  const blitz = [
    { chord: ['ControlLeft', 'MetaLeft'], workflow: 'transcribe' as const },
    { chord: ['ControlRight', 'KeyJ'], workflow: 'improve' as const }
  ]

  it('verlorenes Win-Keyup: Strg allein startet transcribe NICHT (Maske heilt)', () => {
    const d = createHotkeyDispatcher({ bindungen: blitz, mode: 'hold' })
    d.handle({ type: 'down', key: 'MetaLeft', modifiers: maske({ meta: true }) })
    // Keyup verloren; später Strg allein:
    expect(d.handle({ type: 'down', key: 'ControlLeft', modifiers: maske({ ctrl: true }) })).toBeNull()
  })

  it('setzeZurueck() bricht den aktiven Workflow ab und leert das Tracking aller Matcher', () => {
    const d = createHotkeyDispatcher({ bindungen: blitz, mode: 'hold' })
    d.handle({ type: 'down', key: 'MetaLeft' })
    expect(d.handle({ type: 'down', key: 'ControlLeft' })).toEqual({
      aktion: 'start',
      workflow: 'transcribe'
    })

    expect(d.setzeZurueck()).toEqual({ aktion: 'cancel', workflow: 'transcribe' })

    // Tracking geleert: Strg allein startet nicht mehr …
    expect(d.handle({ type: 'down', key: 'ControlLeft' })).toBeNull()
    d.handle({ type: 'up', key: 'ControlLeft' })
    // … der volle Chord schon:
    d.handle({ type: 'down', key: 'MetaLeft' })
    expect(d.handle({ type: 'down', key: 'ControlLeft' })).toEqual({
      aktion: 'start',
      workflow: 'transcribe'
    })
  })

  it('setzeZurueck() im Leerlauf → null', () => {
    const d = createHotkeyDispatcher({ bindungen: blitz, mode: 'hold' })
    expect(d.setzeZurueck()).toBeNull()
  })
})
