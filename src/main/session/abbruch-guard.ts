// Reines Prädikat für den prozessweiten unhandledRejection-Wächter (#03). Hintergrund: ein
// abgebrochener/getimeouteter undici-fetch kann eine unhandledRejection erzeugen (RESEARCH R1). Der
// Wächter darf NUR Abbruch/Timeout schlucken — alles andere muss eskalieren (echte Bugs nicht maskieren).

const ABBRUCH_NAMEN = ['AbortError', 'TimeoutError']

/** true, wenn der Grund (oder seine cause) ein Abbruch/Timeout ist — und damit geschluckt werden darf. */
export function istAbbruchOderTimeout(grund: unknown): boolean {
  if (!(grund instanceof Error)) return false
  if (ABBRUCH_NAMEN.includes(grund.name)) return true
  const cause = (grund as { cause?: unknown }).cause
  return cause instanceof Error && ABBRUCH_NAMEN.includes(cause.name)
}
