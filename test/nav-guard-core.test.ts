import { describe, it, expect } from 'vitest'
import { mussFragen } from '@renderer/lib/nav-guard-core'
import { fehlendeHilfeTopics, unbekannteNavIds } from '@renderer/lib/nav-governance'

describe('mussFragen (Guard-Entscheidung)', () => {
  it('false bei keiner Quelle', () => expect(mussFragen([])).toBe(false))
  it('false wenn alle sauber', () => expect(mussFragen([false, false])).toBe(false))
  it('true bei einer schmutzigen Quelle', () => expect(mussFragen([true])).toBe(true))
  it('true wenn mindestens eine schmutzig', () => expect(mussFragen([false, true])).toBe(true))
})

describe('fehlendeHilfeTopics', () => {
  it('leer, wenn alle Nicht-Ausnahme-Sections gemappt sind', () => {
    expect(fehlendeHilfeTopics(['home', 'about'] as const, { home: 't.home' }, new Set(['about']))).toEqual([])
  })
  it('meldet eine ungemappte Nicht-Ausnahme-Section', () => {
    expect(fehlendeHilfeTopics(['home', 'workflows'] as const, { home: 't' }, new Set())).toEqual([
      'workflows'
    ])
  })
})

describe('unbekannteNavIds', () => {
  it('leer bei integerer Navigation', () => {
    expect(unbekannteNavIds(['home', 'about'], ['home', 'about'])).toEqual([])
  })
  it('meldet verwaiste Id', () => {
    expect(unbekannteNavIds(['home', 'xyz'], ['home', 'about'])).toEqual(['xyz'])
  })
})
