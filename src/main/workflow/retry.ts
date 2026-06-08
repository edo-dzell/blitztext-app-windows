// Begrenzter Wiederhol-Mechanismus für transiente Anbieter-Fehler (CONTEXT.md Fehler-Art 'netzwerk').
// Rein/deterministisch testbar über den injizierten sleep-Port. Wiederholt NUR, wenn retrybar(fehler).
// Läuft im selben Watchdog-Fenster des Aufrufers (kein eigener Timer) — ein gefeuerter Watchdog beendet
// die Wiederholungen über retrybar (abgebrochen/Timeout → false). (Retry-After-Header-Auswertung: später.)

export interface RetryOptions {
  /** Gesamtzahl Versuche (1 = kein Retry). */
  versuche: number
  /** Basis-Backoff in ms; je Wiederholung verdoppelt (300 → 600 → …). */
  backoffMs: number
  /** Entscheidet, ob ein Fehler einen weiteren Versuch wert ist (transient/netzwerk). */
  retrybar: (fehler: unknown) => boolean
  /** Injizierbar für Tests; Default echte Verzögerung. */
  sleep?: (ms: number) => Promise<void>
}

export async function mitRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  for (let versuch = 1; ; versuch++) {
    try {
      return await fn()
    } catch (fehler) {
      if (versuch >= opts.versuche || !opts.retrybar(fehler)) throw fehler
      await sleep(opts.backoffMs * 2 ** (versuch - 1))
    }
  }
}
