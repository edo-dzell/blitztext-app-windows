// Prompt-Assistent (ADR-0008, V2 Strang C): hilft dem Nutzer, aus einer kurzen Beschreibung einen
// brauchbaren System-Prompt für einen eigenen Umschreibe-Workflow zu formulieren. Reine Logik —
// die Ausführung läuft über den vorhandenen RewriteProvider (Chat), verdrahtet in der Komposition.

/** Baut die Chat-Anfrage (system/user), die einen System-Prompt-Entwurf erzeugt. */
export function buildAssistentAnfrage(beschreibung: string): { system: string; user: string } {
  const system = [
    'Du hilfst dabei, einen System-Prompt für einen Sprache-zu-Text-Umschreibe-Workflow zu formulieren.',
    'Der Workflow bekommt ein gesprochenes Transkript und soll es gemäß dem Wunsch des Nutzers umschreiben.',
    'Schreibe einen klaren, knappen System-Prompt auf Deutsch, der dem Modell genau sagt, was es tun soll.',
    'Der Prompt MUSS am Ende verlangen, NUR den fertigen Text zurückzugeben (keine Erklärungen).',
    'Gib NUR den fertigen System-Prompt-Text zurück, ohne Anführungszeichen und ohne Vorrede.'
  ].join(' ')
  return { system, user: `Beschreibung des gewünschten Workflows:\n${beschreibung.trim()}` }
}

/**
 * Assistent-Anfrage, die einen BESTEHENDEN Prompt verbessert statt neu zu erstellen (W-4/#25). Ist
 * kein Prompt hinterlegt (leer), wird auf „neu erstellen" (`buildAssistentAnfrage`) zurückgefallen.
 */
export function buildAssistentVerbesserung(
  bestehend: string,
  beschreibung: string
): { system: string; user: string } {
  if (bestehend.trim() === '') return buildAssistentAnfrage(beschreibung)
  const system = [
    'Du verbesserst einen BESTEHENDEN System-Prompt für einen Sprache-zu-Text-Umschreibe-Workflow.',
    'Behalte die bewährte Struktur und Absicht bei und arbeite die gewünschte Änderung sauber ein.',
    'Der Prompt MUSS am Ende verlangen, NUR den fertigen Text zurückzugeben (keine Erklärungen).',
    'Gib NUR den fertigen, verbesserten System-Prompt-Text zurück, ohne Anführungszeichen und ohne Vorrede.'
  ].join(' ')
  const user = `Bestehender System-Prompt:\n${bestehend.trim()}\n\nGewünschte Änderung:\n${beschreibung.trim()}`
  return { system, user }
}

/** Modell/Temperatur für den Assistenten (etwas Spielraum, kleines Modell genügt). */
export const ASSISTENT_TEMPERATUR = 0.4
