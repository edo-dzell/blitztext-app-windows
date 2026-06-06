import { describe, it, expect } from 'vitest'
import { naechsteAuswahl } from '@renderer/lib/verlauf-auswahl'
import type { VerlaufEintrag } from '@main/history/history-store'

const e = (id: string): VerlaufEintrag => ({ id }) as unknown as VerlaufEintrag

describe('naechsteAuswahl (P5a)', () => {
  it('behält die gültige aktuelle Auswahl', () => {
    expect(naechsteAuswahl([e('a'), e('b')], 'b')).toBe('b')
  })
  it('fällt auf den neuesten, wenn die aktuelle Id nicht mehr existiert', () => {
    expect(naechsteAuswahl([e('a'), e('b')], 'weg')).toBe('a')
  })
  it('wählt bei null + nicht-leerer Liste den neuesten', () => {
    expect(naechsteAuswahl([e('a')], null)).toBe('a')
  })
  it('leere Liste → null', () => {
    expect(naechsteAuswahl([], 'x')).toBe(null)
  })
})
