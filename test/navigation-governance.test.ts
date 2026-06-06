import { describe, it, expect } from 'vitest'
import {
  SECTIONS,
  NAV_TOP_IDS,
  NAV_BOTTOM_IDS,
  HELP_TOPICS,
  HELP_TOPIC_FUER_SECTION,
  SECTIONS_OHNE_HILFE
} from '@renderer/config/navigation'
import { fehlendeHilfeTopics, unbekannteNavIds } from '@renderer/lib/nav-governance'

// Struktureller Governance-Zwang (P1): bricht den Build, sobald eine Section ohne Hilfe-Topic
// hinzukommt. Hält die Hilfe-Seite zwingend mit der Navigation synchron.
describe('Navigations-Governance (P1)', () => {
  it('jede Section außer Ausnahmen hat ein Hilfe-Topic', () => {
    expect(fehlendeHilfeTopics(SECTIONS, HELP_TOPIC_FUER_SECTION, SECTIONS_OHNE_HILFE)).toEqual([])
  })

  it('jedes gemappte Topic existiert in HELP_TOPICS', () => {
    const topicIds = new Set(HELP_TOPICS.map((t) => t.id))
    for (const topic of Object.values(HELP_TOPIC_FUER_SECTION)) {
      expect(topicIds.has(topic as string)).toBe(true)
    }
  })

  it('keine verwaisten Nav-Ids', () => {
    const navIds = [...NAV_TOP_IDS, ...NAV_BOTTOM_IDS].map((n) => n.id)
    expect(unbekannteNavIds(navIds, SECTIONS)).toEqual([])
  })

  it('keine Duplikate in den Nav-Ids', () => {
    const navIds = [...NAV_TOP_IDS, ...NAV_BOTTOM_IDS].map((n) => n.id)
    expect(new Set(navIds).size).toBe(navIds.length)
  })
})
