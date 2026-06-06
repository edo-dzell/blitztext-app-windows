// Reine Entscheidungslogik des globalen Navigations-Guards (P8). Die React-Verdrahtung (NavGuard.tsx)
// nutzt diese Funktion; hier node-testbar isoliert (kein React, kein @/-Alias).

/** Vor einer Navigation fragen, wenn mindestens eine registrierte Quelle ungespeicherte Änderungen hat. */
export function mussFragen(dirtyFlags: readonly boolean[]): boolean {
  return dirtyFlags.some(Boolean)
}
