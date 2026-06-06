// Reine Prüfer für die Navigations-Governance (P1). Parametrisiert → kein Import von navigation.ts,
// damit dieses Modul unabhängig testbar ist; der eigentliche Governance-Test (Slice 3) speist die
// echten Navigationsdaten ein. Erzwingt: jede Section (außer Ausnahmen) hat ein Hilfe-Topic.

/** Sections (außer Ausnahmen), für die KEIN Hilfe-Topic hinterlegt ist. Leer = vollständig abgedeckt. */
export function fehlendeHilfeTopics<S extends string>(
  sections: readonly S[],
  hilfeTopicFuerSection: Partial<Record<S, string>>,
  ausnahmen: ReadonlySet<string>
): S[] {
  return sections.filter((s) => !ausnahmen.has(s) && !hilfeTopicFuerSection[s])
}

/** Nav-Ids, die keiner bekannten Section entsprechen (verwaiste Navigation). Leer = integer. */
export function unbekannteNavIds<S extends string>(
  navIds: readonly string[],
  sections: readonly S[]
): string[] {
  const bekannt = new Set<string>(sections)
  return navIds.filter((id) => !bekannt.has(id))
}
