// Umschreiben über OpenAI Chat Completions (ADR-0001), hinter dem RewriteProvider-Interface.
// fetch + Key injizierbar → ohne echtes Netz testbar. Treue Portierung von LLMService.swift.
// Modell/Temperatur kommen vom Aufrufer (gpt-4o-mini@0.3 improve/emoji, gpt-4o@0.4 calm).

import { leseFehlerDetail, type AnbieterFehler } from '@main/workflow/fehler-klassifikation'

export interface RewriteErgebnis {
  text: string
  /** Token-Verbrauch laut Anbieter (für die Kostenstatistik, Strang D); fehlt, wenn nicht geliefert. */
  usage?: { promptTokens: number; completionTokens: number }
}

export interface RewriteProvider {
  rewrite(
    input: { system: string; user: string },
    opts: { model: string; temperature: number; signal?: AbortSignal }
  ): Promise<RewriteErgebnis>
}

const OPENAI_BASE_URL = 'https://api.openai.com/v1'

export function createCloudRewriteProvider(deps: {
  getApiKey: () => Promise<string | null>
  /** OpenAI-kompatible Base-URL OHNE Trailing-Slash; ohne Angabe = OpenAI (v1-Verhalten). */
  getBaseUrl?: () => string
  /** L1: erlaubt einen Lauf OHNE Key (key-loser lokaler Anbieter) → kein Authorization-Header. */
  erlaubeOhneKey?: () => boolean
  fetchFn?: typeof fetch
}): RewriteProvider {
  const fetchFn = deps.fetchFn ?? fetch
  const getBaseUrl = deps.getBaseUrl ?? (() => OPENAI_BASE_URL)

  return {
    async rewrite(input, opts) {
      const apiKey = await deps.getApiKey()
      if (!apiKey && !deps.erlaubeOhneKey?.()) {
        throw new Error('OpenAI API-Key fehlt. Bitte in den Einstellungen hinterlegen.')
      }

      let response: Response
      try {
        response = await fetchFn(`${getBaseUrl()}/chat/completions`, {
          method: 'POST',
          headers: apiKey
            ? { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            : { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: opts.model,
            temperature: opts.temperature,
            messages: [
              { role: 'system', content: input.system },
              { role: 'user', content: input.user }
            ]
          }),
          signal: opts.signal
        })
      } catch (cause) {
        // Abbruch/Timeout unverändert weiterreichen, damit der Aufrufer (Reducer) sie klassifizieren kann.
        if (cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')) {
          throw cause
        }
        // Transport-Fehler (DNS/offline/Verbindung) — klare deutsche Meldung statt roher TypeError.
        const fehler = new Error(
          'Netzwerkfehler: Keine Verbindung zu OpenAI. Bitte Internetverbindung prüfen.',
          { cause }
        ) as AnbieterFehler
        fehler.transport = true // Transport-/Verbindungsfehler → Fehler-Art netzwerk
        throw fehler
      }

      const raw = await response.text()

      if (response.status !== 200) {
        // Anbieterneutrales Präfix (Mehr-Anbieter). Fehler-Body verschachtelt (OpenAI: error.message)
        // ODER FLACH (Mistral: message; manche: detail) — beide Formen lesen, sonst geht z. B. die
        // „Invalid model"-Ursache bei Mistral/Groq verloren und es bliebe nur „Status 400".
        let message = `KI-Fehler: Status ${response.status}`
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
          if (detail) message = `KI-Fehler: ${detail}`
          providerCode = parsed.error?.code ?? parsed.error?.type ?? parsed.code ?? parsed.type
        } catch {
          // kein JSON-Fehlerkörper
        }
        const fehler = new Error(message) as AnbieterFehler
        fehler.status = response.status
        if (providerCode) fehler.providerCode = providerCode
        throw fehler
      }

      let content = ''
      let usage: RewriteErgebnis['usage']
      try {
        const parsed = JSON.parse(raw) as {
          choices?: { message?: { content?: string } }[]
          usage?: { prompt_tokens?: number; completion_tokens?: number }
        }
        content = (parsed.choices?.[0]?.message?.content ?? '').trim()
        if (parsed.usage) {
          usage = {
            promptTokens: parsed.usage.prompt_tokens ?? 0,
            completionTokens: parsed.usage.completion_tokens ?? 0
          }
        }
      } catch {
        // ungültiger Body — als leere Antwort behandeln
      }

      if (content === '') throw new Error('Keine Antwort erhalten. Bitte nochmal versuchen.')
      return { text: content, usage }
    }
  }
}
