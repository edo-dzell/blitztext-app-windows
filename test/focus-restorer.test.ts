import { describe, it, expect } from 'vitest'
import { createFocusRestorer, type FensterEffekt } from '@main/output/focus-restorer'

function fakeEffekt(opts: { vordergrund?: number | null; gueltig?: boolean }) {
  const log: string[] = []
  const effekt: FensterEffekt = {
    aktuellesVordergrundfenster: () => opts.vordergrund ?? null,
    istFenster: () => opts.gueltig ?? true,
    fokussiere: (hwnd) => log.push(`fokus:${hwnd}`),
    einfuegen: () => log.push('einfuegen')
  }
  return { effekt, log }
}

describe('FocusRestorer (R4-Spike)', () => {
  it('merkt das Vordergrundfenster und fügt nach Restore ein', () => {
    const { effekt, log } = fakeEffekt({ vordergrund: 42, gueltig: true })
    const r = createFocusRestorer(effekt)
    r.merke()
    expect(r.stelleHerUndFuegeEin()).toBe(true)
    expect(log).toEqual(['fokus:42', 'einfuegen'])
  })

  it('fügt NICHT ein, wenn das gemerkte Fenster ungültig (Stale-HWND) ist', () => {
    const { effekt, log } = fakeEffekt({ vordergrund: 42, gueltig: false })
    const r = createFocusRestorer(effekt)
    r.merke()
    expect(r.stelleHerUndFuegeEin()).toBe(false)
    expect(log).toEqual([])
  })

  it('fügt NICHT ein, wenn nichts gemerkt wurde', () => {
    const { effekt, log } = fakeEffekt({ vordergrund: null })
    const r = createFocusRestorer(effekt)
    expect(r.stelleHerUndFuegeEin()).toBe(false)
    expect(log).toEqual([])
  })
})
