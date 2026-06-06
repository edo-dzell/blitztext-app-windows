// Navigations-Daten als Single Source of Truth (P1). Bewusst OHNE lucide-Icons/React, damit der
// node-only Governance-Test (vitest) dieses Modul importieren kann; die Icons liegen lokal in App.tsx.

export type Section = 'home' | 'workflows' | 'history' | 'stats' | 'settings' | 'about' | 'help'

export interface NavId {
  id: Section
  label: string
}

export const NAV_TOP_IDS: NavId[] = [
  { id: 'home', label: 'Übersicht' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'history', label: 'Verlauf' },
  { id: 'stats', label: 'Statistik' }
]

export const NAV_BOTTOM_IDS: NavId[] = [
  { id: 'settings', label: 'Einstellungen' },
  { id: 'help', label: 'Hilfe' },
  { id: 'about', label: 'Über' }
]

export const SECTIONS: Section[] = [...NAV_TOP_IDS, ...NAV_BOTTOM_IDS].map((n) => n.id)

export const TITEL: Record<Section, string> = {
  home: 'Übersicht',
  workflows: 'Workflows',
  history: 'Verlauf',
  stats: 'Statistik',
  settings: 'Einstellungen',
  about: 'Über Blitztext',
  help: 'Hilfe'
}

/** Ein Hilfe-Topic (Inhalte folgen in Slice 18, hier zunächst Titel als Platzhalter). */
export interface HilfeTopic {
  id: string
  titel: string
}

export const HELP_TOPICS: HilfeTopic[] = [
  { id: 'erste-schritte', titel: 'Erste Schritte' },
  { id: 'workflows', titel: 'Workflows' },
  { id: 'verlauf', titel: 'Verlauf' },
  { id: 'statistik', titel: 'Statistik & Kosten' },
  { id: 'einstellungen', titel: 'Einstellungen' },
  { id: 'problemloesung', titel: 'Problemlösung' }
]

/** Zuordnung Section → Hilfe-Topic (für die „?"-Brücke). about/help sind ausgenommen. */
export const HELP_TOPIC_FUER_SECTION: Partial<Record<Section, string>> = {
  home: 'erste-schritte',
  workflows: 'workflows',
  history: 'verlauf',
  stats: 'statistik',
  settings: 'einstellungen'
}

/** Sections ohne Hilfe-Topic-Pflicht (Info-Seiten / die Hilfe-Seite selbst). */
export const SECTIONS_OHNE_HILFE: ReadonlySet<string> = new Set(['about', 'help'])
