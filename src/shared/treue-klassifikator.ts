// Treue-Klassifikator (v0.4.5): rein/deterministisch, KEIN Modell-Aufruf. Geteilt zwischen dem
// Laufzeit-Detektor (src/main/rewrite/treue-detektor.ts) und dem Eval-Korpus (eval/) — „identischer
// Code", damit die Eval genau das prüft, was ausgeliefert wird (ADR-0018).
//
// Zweck: die wiederkehrende Fehlerklasse erkennen, bei der ein Umschreib-Workflow das Diktat
// BEANTWORTET, statt es zu BEARBEITEN — konkret den Personen-Flip „du …" → „Ich …" (real beobachtet
// 14.6.2026: Roh „… wie du … verarbeiten könntest …" → End „Ich hätte … so verarbeitet, dass ich …").
//
// Bewusst eng und auf PRÄZISION getunt (Experten-Konsens): lieber einen seltenen echten Fehler
// durchlassen (Rückfall = Status quo, evtl. falsches Einfügen) als eine korrekte Politur fälschlich
// abstufen (häufiger, leiser Vertrauensverlust). Marker sind ASCII → \b-Wortgrenzen greifen sauber.

export interface PersonProfil {
  /** Treffer für die 1. Person (ich/mir/mich/wir/uns + Possessiva). */
  erste: number
  /** Treffer für die 2. Person — informell (du/…) UND formell (Sie/Ihnen/…). */
  zweite: number
}

// Exakte Formen (keine \w*-Wildcards): „mein" matcht nur „mein", nie „Meinung".
const ERSTE =
  /\b(ich|mir|mich|wir|uns|mein|meine|meinen|meinem|meiner|meines|unser|unsere|unseren|unserem|unserer|unseres)\b/gi
// Informelle 2. Person (du-Formen sind eindeutig). „ihr/euch" bewusst AUSGELASSEN (mehrdeutig mit der
// 3. Person Dativ/Possessiv → würde die Präzision senken).
const ZWEITE_DU = /\b(du|dir|dich|dein|deine|deinen|deinem|deiner|deines)\b/gi
// Formelle 2. Person: GROSS geschrieben (case-sensitive), um die 3.-Person-Form „sie/ihr" auszuschließen.
const ZWEITE_SIE = /\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/g

function zaehle(text: string, regex: RegExp): number {
  return (text.match(regex) ?? []).length
}

export function personProfil(text: string): PersonProfil {
  return {
    erste: zaehle(text, ERSTE),
    zweite: zaehle(text, ZWEITE_DU) + zaehle(text, ZWEITE_SIE)
  }
}

/**
 * Heuristik: Wirkt der Endtext, als hätte das Modell das Diktat beantwortet/umgedeutet statt es zu
 * bearbeiten? Trigger = klarer PERSONEN-FLIP:
 *   - der Rohtext spricht ein Gegenüber an (2. Person ≥ 1 und mindestens so präsent wie die 1. Person), UND
 *   - der Endtext hat die Anrede VOLLSTÄNDIG verloren (2. Person = 0) und spricht in der 1. Person.
 *
 * Die Bedingung `roh.zweite >= roh.erste` schützt vor Fehlalarmen bei 1.-Person-dominanten Diktaten
 * (eine Ich-Erzählung mit einem Streu-„dir" kippt nicht). Out-of-Scope (bewusst): du→Sie-Wechsel bei
 * gleichbleibender 2. Person (das fängt die Prompt-Härtung ab, nicht dieser Detektor).
 */
export function wirktBeantwortet(rohtext: string, endtext: string): boolean {
  const roh = personProfil(rohtext)
  const end = personProfil(endtext)
  return roh.zweite >= 1 && roh.zweite >= roh.erste && end.zweite === 0 && end.erste >= 1
}
