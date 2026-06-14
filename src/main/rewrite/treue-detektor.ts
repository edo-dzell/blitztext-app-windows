// Laufzeit-Detektor (v0.4.5, ADR-0018): fängt die wiederkehrende Fehlerklasse „Modell beantwortet das
// Diktat, statt es zu bearbeiten" NACH dem Umschreiben ab — bevor falscher Text ins Zieldokument
// eingefügt wird. Schließt die Asymmetrie: den kosmetischen Marken-Leak säubern wir längst strukturell
// (entferneTranskriptMarken), den katastrophalen Antwort-Flip bislang gar nicht.
//
// Bewusst DETERMINISTISCH (reiner Code, KEIN zweiter Modell-Aufruf): null Token-Kosten, ~null Latenz,
// anbieter-neutral und mit der Unit-Suite testbar. Der per-Lauf-LLM-Verifizierer wurde verworfen
// (besteuert 100 % der Läufe für einen seltenen Fehler und reimportierte das „nur per HITL testbar"-
// Problem). Der LLM-Judge lebt nur im Eval-Korpus (eval/), nicht in diesem Laufzeit-Pfad.

import { wirktBeantwortet } from '@shared/treue-klassifikator'

export interface TreueDetektor {
  /**
   * true, wenn der Endtext das Diktat beantwortet/umgedeutet zu haben scheint (statt es zu bearbeiten).
   * Der Runner stuft dann auf Teil-Erfolg ab (Rohtext in die Zwischenablage, kein Auto-Einfügen).
   */
  wirktBeantwortet(rohtext: string, endtext: string): boolean
}

export function createTreueDetektor(): TreueDetektor {
  return { wirktBeantwortet }
}
