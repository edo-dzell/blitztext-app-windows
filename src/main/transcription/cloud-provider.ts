// Cloud-Transkription über einen OpenAI-kompatiblen Anbieter (ADR-0001/0008), hinter dem
// TranscriptionProvider-Interface (Naht für lokale/andere Anbieter). fetch + Key + Provider-Config
// sind injizierbar → ohne echtes Netz testbar. Treue Portierung von TranscriptionService.swift.
//
// V2 (Strang B): Base-URL + Modell kommen aus der aktiven Provider-Config (getConfig). Default ist
// exakt v1: OpenAI/whisper-1 → byte-identische URL + response_format=text.

import { asrUnterstuetztTextFormat } from '@shared/providers'

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
  fetchFn?: typeof fetch
}): TranscriptionProvider {
  const fetchFn = deps.fetchFn ?? fetch
  const getConfig = deps.getConfig ?? (() => OPENAI_DEFAULT)

  return {
    async transcribe(audio, options = {}) {
      const apiKey = await deps.getApiKey()
      if (!apiKey) throw new Error('OpenAI API-Key fehlt. Bitte in den Einstellungen hinterlegen.')

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
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: options.signal
        })
      } catch (cause) {
        // Abbruch/Timeout unverändert weiterreichen, damit der Aufrufer (Reducer) sie klassifizieren kann.
        if (cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')) {
          throw cause
        }
        // Transport-Fehler (DNS/offline/Verbindung) — klare deutsche Meldung statt roher TypeError.
        throw new Error(
          'Netzwerkfehler: Keine Verbindung zum Anbieter. Bitte Internetverbindung prüfen.',
          { cause }
        )
      }

      const raw = await response.text()
      if (response.status !== 200) {
        // Fehler-Body verschachtelt (OpenAI: error.message) ODER flach (Mistral: message) — beide lesen.
        let message = `Anbieter-Fehler: Status ${response.status}`
        try {
          const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string; detail?: string }
          const detail = parsed.error?.message ?? parsed.message ?? parsed.detail
          if (detail) message = `Anbieter-Fehler: ${detail}`
        } catch {
          // kein JSON-Fehlerkörper — Status-Meldung bleibt
        }
        throw new Error(message)
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
