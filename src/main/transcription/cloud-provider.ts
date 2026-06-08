// Cloud-Transkription über einen OpenAI-kompatiblen Anbieter (ADR-0001/0008), hinter dem
// TranscriptionProvider-Interface (Naht für lokale/andere Anbieter). fetch + Key + Provider-Config
// sind injizierbar → ohne echtes Netz testbar. Treue Portierung von TranscriptionService.swift.
//
// V2 (Strang B): Base-URL + Modell kommen aus der aktiven Provider-Config (getConfig). Default ist
// exakt v1: OpenAI/whisper-1 → byte-identische URL + response_format=text.

import { asrUnterstuetztTextFormat } from '@shared/providers'
import { leseFehlerDetail, type AnbieterFehler } from '@main/workflow/fehler-klassifikation'

export interface TranscribeOptions {
  language?: string
  vocabularyHints?: string[]
  /** Abbruch-Signal; wird an fetch durchgereicht. AbortError/TimeoutError werden unverändert geworfen. */
  signal?: AbortSignal
}

export interface TranscriptionProvider {
  transcribe(audio: Blob, options?: TranscribeOptions): Promise<string>
}

export interface TranscriptionConfig {
  /** OpenAI-kompatible Base-URL OHNE Trailing-Slash. */
  baseUrl: string
  model: string
}

const OPENAI_DEFAULT: TranscriptionConfig = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'whisper-1'
}

export function createCloudTranscriptionProvider(deps: {
  getApiKey: () => Promise<string | null>
  /** Aktive Provider-Config; ohne Angabe = OpenAI/whisper-1 (v1-Verhalten). */
  getConfig?: () => TranscriptionConfig
  /** L1: erlaubt einen Lauf OHNE Key (key-loser lokaler Anbieter) → kein Authorization-Header. */
  erlaubeOhneKey?: () => boolean
  fetchFn?: typeof fetch
}): TranscriptionProvider {
  const fetchFn = deps.fetchFn ?? fetch
  const getConfig = deps.getConfig ?? (() => OPENAI_DEFAULT)

  return {
    async transcribe(audio, options = {}) {
      const apiKey = await deps.getApiKey()
      if (!apiKey && !deps.erlaubeOhneKey?.()) {
        throw new Error('OpenAI API-Key fehlt. Bitte in den Einstellungen hinterlegen.')
      }

      const { baseUrl, model } = getConfig()
      const textFormat = asrUnterstuetztTextFormat(model)

      const form = new FormData()
      form.append('file', audio, 'audio.webm')
      form.append('model', model)
      // Whisper-Familie kann response_format=text; andere (gpt-4o-transcribe*, Voxtral) nur JSON.
      form.append('response_format', textFormat ? 'text' : 'json')
      if (options.language && options.language.trim() !== '') {
        form.append('language', options.language.trim())
      }
      if (options.vocabularyHints && options.vocabularyHints.length > 0) {
        form.append('prompt', `Eigennamen und Begriffe: ${options.vocabularyHints.join(', ')}`)
      }

      let response: Response
      try {
        response = await fetchFn(`${baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          body: form,
          signal: options.signal
        })
      } catch (cause) {
        // Abbruch/Timeout unverändert weiterreichen, damit der Aufrufer (Reducer) sie klassifizieren kann.
        if (cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')) {
          throw cause
        }
        // Transport-Fehler (DNS/offline/Verbindung) — klare deutsche Meldung statt roher TypeError.
        const fehler = new Error(
          'Netzwerkfehler: Keine Verbindung zum Anbieter. Bitte Internetverbindung prüfen.',
          { cause }
        ) as AnbieterFehler
        fehler.transport = true // Transport-/Verbindungsfehler → Fehler-Art netzwerk
        throw fehler
      }

      const raw = await response.text()
      if (response.status !== 200) {
        // Fehler-Body verschachtelt (OpenAI: error.message) ODER flach (Mistral: message/detail) — beide lesen.
        let message = `Anbieter-Fehler: Status ${response.status}`
        let providerCode: string | undefined
        try {
          const parsed = JSON.parse(raw) as {
            error?: { message?: string; code?: string; type?: string }
            message?: string
            detail?: unknown
            code?: string
            type?: string
          }
          const detail = leseFehlerDetail(parsed)
          if (detail) message = `Anbieter-Fehler: ${detail}`
          providerCode = parsed.error?.code ?? parsed.error?.type ?? parsed.code ?? parsed.type
        } catch {
          // kein JSON-Fehlerkörper — Status-Meldung bleibt
        }
        const fehler = new Error(message) as AnbieterFehler
        fehler.status = response.status
        if (providerCode) fehler.providerCode = providerCode
        throw fehler
      }

      if (textFormat) return raw.trim()
      // JSON-Antwort: das `text`-Feld extrahieren (OpenAI-kompatibel: { text: "…" }).
      try {
        const parsed = JSON.parse(raw) as { text?: string }
        return (parsed.text ?? '').trim()
      } catch {
        return raw.trim()
      }
    }
  }
}
