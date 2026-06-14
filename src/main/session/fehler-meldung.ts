// Bildet eine Fehler-Art (CONTEXT.md) auf eine nutzergerichtete Meldung ab — rein/testbar. Der
// Anzeige-Konsument (index.ts) zeigt sie als Windows-Notification; bei `aktion:'einstellungen'` bietet
// er einen Sprung in die Einstellungen an. Nur technische Fakten, keine Rechts-/Compliance-Aussagen (ADR-0016).

import type { FehlerArt } from '@main/workflow/fehler-klassifikation'
import type { TeilErfolgGrund } from '@main/workflow/runner'

export interface FehlerMeldung {
  titel: string
  koerper: string
  /** Wenn gesetzt: der Adapter bietet einen Sprung in die Einstellungen an (z. B. Notification-Klick). */
  aktion?: 'einstellungen'
}

/**
 * Nutzergerichtete Meldung für einen Teil-Erfolg (Rohtext liegt in der Zwischenablage). Der Grund
 * unterscheidet, WARUM nicht eingefügt wurde: Umschreib-Fehler vs. Treue-Befund (das Modell hat das
 * Diktat beantwortet, v0.4.5). Ehrlich + spezifisch, damit auch ein Fehlalarm verständlich bleibt.
 */
export function teilErfolgMeldung(grund: TeilErfolgGrund): FehlerMeldung {
  switch (grund) {
    case 'umschreibfehler':
      return {
        titel: 'Umschreiben fehlgeschlagen',
        koerper: 'Der Rohtext liegt in der Zwischenablage — mit Strg+V einfügen.'
      }
    case 'beantwortet':
      return {
        titel: 'Diktat nicht eingefügt',
        koerper:
          'Das Diktat sah aus wie eine Anweisung an die KI — der Rohtext liegt in der Zwischenablage, kein automatisches Einfügen.'
      }
  }
}

export function fehlerMeldung(art: FehlerArt, message: string): FehlerMeldung {
  switch (art) {
    case 'aufnahme':
      return { titel: 'Nichts aufgenommen', koerper: message }
    case 'konfiguration':
      return { titel: 'Einrichtung prüfen', koerper: message, aktion: 'einstellungen' }
    case 'netzwerk':
      return {
        titel: 'Keine Verbindung',
        koerper: 'Verbindung zum Anbieter fehlgeschlagen — bitte später erneut versuchen.'
      }
    case 'anbieter':
      return { titel: 'Fehler beim Anbieter', koerper: message }
  }
}
