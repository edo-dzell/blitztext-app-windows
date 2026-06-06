import { describe, it, expect } from 'vitest'
import { entscheideFokusRueckkehr } from '@main/output/fokus-rueckkehr'

describe('entscheideFokusRueckkehr (#27, F-1)', () => {
  it('restauriert bei echtem Drift (erfasstes != aktuelles Fenster)', () => {
    expect(
      entscheideFokusRueckkehr({ aktiviert: true, erfasstesHwnd: 100, aktuellesHwnd: 200 })
    ).toEqual({ restauriere: true, hwnd: 100 })
  })

  it('tut nichts ohne Drift (gleiches Fenster — kein synthetisches ALT im Normalfall)', () => {
    expect(
      entscheideFokusRueckkehr({ aktiviert: true, erfasstesHwnd: 100, aktuellesHwnd: 100 })
    ).toEqual({ restauriere: false, hwnd: null })
  })

  it('tut nichts, wenn das Feature aus ist', () => {
    expect(
      entscheideFokusRueckkehr({ aktiviert: false, erfasstesHwnd: 100, aktuellesHwnd: 200 })
    ).toEqual({ restauriere: false, hwnd: null })
  })

  it('tut nichts, wenn kein Fenster erfasst wurde', () => {
    expect(
      entscheideFokusRueckkehr({ aktiviert: true, erfasstesHwnd: null, aktuellesHwnd: 200 })
    ).toEqual({ restauriere: false, hwnd: null })
  })
})
