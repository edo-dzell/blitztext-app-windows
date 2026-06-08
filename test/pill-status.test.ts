import { describe, it, expect } from 'vitest'
import { pillenStatus } from '@main/window/pill-status'

describe('pillenStatus', () => {
  it('zeigt die aktiven Phasen mit Label', () => {
    expect(pillenStatus({ status: 'aufnehmen' })).toEqual({ sichtbar: true, label: '🎙 Aufnahme …' })
    expect(pillenStatus({ status: 'transkribieren' }).sichtbar).toBe(true)
    expect(pillenStatus({ status: 'umschreiben' }).sichtbar).toBe(true)
  })

  it('versteckt die Pille bei idle und fertig', () => {
    expect(pillenStatus({ status: 'idle' }).sichtbar).toBe(false)
    expect(pillenStatus({ status: 'fertig', text: 'x' }).sichtbar).toBe(false)
  })

  it('zeigt Fehler mit Meldung', () => {
    const s = pillenStatus({ status: 'fehler', art: 'anbieter', message: 'OpenAI-Fehler' })
    expect(s.sichtbar).toBe(true)
    expect(s.label).toContain('OpenAI-Fehler')
  })

  it('zeigt Teil-Erfolg (Rohtext in Zwischenablage)', () => {
    const s = pillenStatus({ status: 'teilErfolg', rohtext: 'x', warnung: 'w' })
    expect(s.sichtbar).toBe(true)
    expect(s.label).toContain('Zwischenablage')
  })
})
