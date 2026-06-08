// Fehler-Art-Klassifikation (CONTEXT.md „Fehler-Art"): ordnet einen gefangenen Anbieter-Fehler einer
// der vier Fehler-Arten zu — rein und testbar. Liest strukturierte Felder, die die Cloud-Provider beim
// Werfen ADDITIV anhängen (siehe transcription/rewrite cloud-provider.ts): `.status` (HTTP),
// `.transport` (true bei DNS/offline/Verbindungs-Fehler) und `.providerCode` (error.code/type aus dem Body).
// Plain-Errors ohne diese Felder (z. B. Test-Fakes, „Keine Antwort erhalten") landen bewusst auf 'anbieter'.

export type FehlerArt = 'aufnahme' | 'konfiguration' | 'netzwerk' | 'anbieter'

/** Strukturierte Zusatzfelder, die die Provider beim Werfen anhängen (additiv; Message-Text bleibt). */
export interface AnbieterFehler extends Error {
  /** HTTP-Status bei Nicht-2xx-Antworten. */
  status?: number
  /** true bei Transport-/Verbindungsfehlern (DNS, offline, Connection refused/reset) — immer netzwerk. */
  transport?: boolean
  /** error.code/type aus dem Fehler-Body (z. B. 'insufficient_quota'). */
  providerCode?: string
}

export interface KlassifikationsKontext {
  /** Der Watchdog hat den (hängenden) Anbieter-Aufruf abgebrochen. */
  istWatchdogTimeout: boolean
}

export function klassifiziere(err: unknown, kontext: KlassifikationsKontext): FehlerArt {
  // Watchdog-Zeitüberschreitung = hängender Anbieter, NICHT Netz (und bewusst nicht retrybar).
  if (kontext.istWatchdogTimeout) return 'anbieter'

  const e = (typeof err === 'object' && err !== null ? err : {}) as AnbieterFehler

  // Transport-/Verbindungsfehler (DNS, offline, Connection refused/reset) → netzwerk.
  if (e.transport === true) return 'netzwerk'

  if (typeof e.status === 'number') {
    const s = e.status
    // Auth-/Anfrage-/Konfigurationsfehler → handlungsleitend (Einstellungen).
    if (s === 400 || s === 401 || s === 403 || s === 404 || s === 422) return 'konfiguration'
    if (s === 429) {
      // Kontingent erschöpft = Abrechnung/Konfiguration (nicht wiederholbar); reine Rate-Limit = netzwerk.
      return e.providerCode === 'insufficient_quota' ? 'konfiguration' : 'netzwerk'
    }
    // Server-Zeitüberschreitung + transiente Serverfehler → netzwerk (wiederholbar).
    if (s === 408 || (s >= 500 && s <= 599)) return 'netzwerk'
    return 'anbieter'
  }

  // Kein strukturiertes Signal → unspezifischer Anbieter-Fehler.
  return 'anbieter'
}

/** Liest die menschenlesbare Ursache aus einem OpenAI-kompatiblen Fehler-Body — typsicher gegen
 *  '[object Object]' bei nicht-String-`detail` (z. B. Mistral-Validierungs-Arrays). */
export function leseFehlerDetail(parsed: {
  error?: { message?: string }
  message?: string
  detail?: unknown
}): string | undefined {
  const ausError = parsed.error?.message
  if (typeof ausError === 'string') return ausError
  if (typeof parsed.message === 'string') return parsed.message
  const d = parsed.detail
  if (typeof d === 'string') return d
  if (d != null) return JSON.stringify(d)
  return undefined
}
