// Bildet eine Fehler-Art (CONTEXT.md) auf eine nutzergerichtete Meldung ab — rein/testbar. Der
// Anzeige-Konsument (index.ts) zeigt sie als Windows-Notification; bei `aktion:'einstellungen'` bietet
// er einen Sprung in die Einstellungen an. Nur technische Fakten, keine Rechts-/Compliance-Aussagen (ADR-0016).

import type { FehlerArt } from '@main/workflow/fehler-klassifikation'

export interface FehlerMeldung {
  titel: string
  koerper: string
  /** Wenn gesetzt: der Adapter bietet einen Sprung in die Einstellungen an (z. B. Notification-Klick). */
  aktion?: 'einstellungen'
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
