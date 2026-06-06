import { describe, it, expect } from 'vitest'
import { createHotkeyDispatcher } from '@main/hotkey/dispatcher'

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
