// Reine Vorauswahl-Logik für den Verlauf (P5a). Node-testbar, kein React, kein @/-Alias.

import type { VerlaufEintrag } from '@main/history/history-store'

/**
 * Nächste Auswahl nach dem Laden: behält die aktuelle, wenn sie noch existiert; sonst der neueste
 * Eintrag (Store liefert neueste zuerst → eintraege[0]); leere Liste → null. Deckt zugleich
 * „Wechsel in den Verlauf" (aktuelleId=null → neuester) und „Variante 1 nach Löschen" ab.
 */
export function naechsteAuswahl(
  eintraege: readonly VerlaufEintrag[],
  aktuelleId: string | null
): string | null {
  if (aktuelleId !== null && eintraege.some((e) => e.id === aktuelleId)) return aktuelleId
  return eintraege[0]?.id ?? null
}
