import { describe, it, expect } from 'vitest'
import { klassifiziere, type AnbieterFehler } from '@main/workflow/fehler-klassifikation'

function fehler(props: Partial<AnbieterFehler> & { message?: string }): AnbieterFehler {
  const e = new Error(props.message ?? 'x') as AnbieterFehler
  Object.assign(e, props)
  return e
}
const kein = { istWatchdogTimeout: false }

describe('klassifiziere', () => {
  it('Watchdog-Timeout → anbieter (auch wenn der Fehler sonst netzwerk wäre)', () => {
    expect(klassifiziere(fehler({ transport: true }), { istWatchdogTimeout: true })).toBe('anbieter')
  })

  it('Transport-/Verbindungsfehler → netzwerk', () => {
    expect(klassifiziere(fehler({ transport: true }), kein)).toBe('netzwerk')
  })

  it('HTTP 400/401/403/404/422 → konfiguration', () => {
    for (const s of [400, 401, 403, 404, 422]) {
      expect(klassifiziere(fehler({ status: s }), kein)).toBe('konfiguration')
    }
  })

  it('HTTP 429 ohne insufficient_quota → netzwerk (Rate-Limit, wiederholbar)', () => {
    expect(klassifiziere(fehler({ status: 429 }), kein)).toBe('netzwerk')
  })

  it('HTTP 429 mit providerCode insufficient_quota → konfiguration', () => {
    expect(klassifiziere(fehler({ status: 429, providerCode: 'insufficient_quota' }), kein)).toBe(
      'konfiguration'
    )
  })

  it('HTTP 408/5xx → netzwerk (transient/wiederholbar)', () => {
    for (const s of [408, 500, 502, 503, 504]) {
      expect(klassifiziere(fehler({ status: s }), kein)).toBe('netzwerk')
    }
  })

  it('ohne strukturiertes Signal → anbieter', () => {
    expect(klassifiziere(fehler({ message: 'Keine Antwort erhalten.' }), kein)).toBe('anbieter')
    expect(klassifiziere('seltsam', kein)).toBe('anbieter')
    expect(klassifiziere(null, kein)).toBe('anbieter')
  })
})
