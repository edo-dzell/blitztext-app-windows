import { describe, it, expect } from 'vitest'
import { fehlerMeldung } from '@main/session/fehler-meldung'

describe('fehlerMeldung', () => {
  it('konfiguration → Sprung in die Einstellungen, trägt die Ursache', () => {
    const m = fehlerMeldung('konfiguration', 'Ungültiger Key')
    expect(m.aktion).toBe('einstellungen')
    expect(m.koerper).toContain('Ungültiger Key')
  })

  it('netzwerk → freundlicher Wiederhol-Hinweis, keine Aktion', () => {
    const m = fehlerMeldung('netzwerk', 'roh')
    expect(m.aktion).toBeUndefined()
    expect(m.titel).toBe('Keine Verbindung')
  })

  it('aufnahme → trägt die Ursache, keine Aktion', () => {
    const m = fehlerMeldung('aufnahme', 'Keine Aufnahme erkannt.')
    expect(m.aktion).toBeUndefined()
    expect(m.koerper).toBe('Keine Aufnahme erkannt.')
  })

  it('anbieter → trägt die Ursache', () => {
    expect(fehlerMeldung('anbieter', 'Server kaputt').koerper).toBe('Server kaputt')
  })
})
