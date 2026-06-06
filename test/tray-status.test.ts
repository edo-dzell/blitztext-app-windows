import { describe, it, expect } from 'vitest'
import { phaseTooltip } from '@main/window/tray-status'

describe('phaseTooltip', () => {
  it('spiegelt jede Workflow-Phase in einen Tooltip', () => {
    expect(phaseTooltip({ status: 'idle' })).toBe('Blitztext')
    expect(phaseTooltip({ status: 'aufnehmen' })).toBe('Blitztext — Aufnahme …')
    expect(phaseTooltip({ status: 'transkribieren' })).toBe('Blitztext — Transkribiere …')
    expect(phaseTooltip({ status: 'umschreiben' })).toBe('Blitztext — Schreibe um …')
    expect(phaseTooltip({ status: 'fertig', text: 'hallo' })).toBe('Blitztext — Fertig')
  })

  it('trägt die Fehlermeldung in den Tooltip', () => {
    expect(phaseTooltip({ status: 'fehler', art: 'anbieter', message: 'OpenAI-Fehler' })).toBe(
      'Blitztext — Fehler: OpenAI-Fehler'
    )
  })
})
