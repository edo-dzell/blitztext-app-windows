import { describe, it, expect } from 'vitest'
import { createCloudTranscriptionProvider } from '@main/transcription/cloud-provider'

function audioBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })
}

describe('createCloudTranscriptionProvider', () => {
  it('gibt bei HTTP 200 den getrimmten Transkript-Text zurück', async () => {
    const fetchFn = (async () =>
      new Response('  Hallo Welt  ', { status: 200 })) as unknown as typeof fetch

    const provider = createCloudTranscriptionProvider({
      getApiKey: async () => 'sk-key',
      fetchFn
    })

    expect(await provider.transcribe(audioBlob())).toBe('Hallo Welt')
  })

  it('schickt POST an die Transcriptions-URL mit Bearer-Auth', async () => {
    let url: string | undefined
    let init: RequestInit | undefined
    const fetchFn = (async (u: string, i: RequestInit) => {
      url = u
      init = i
      return new Response('ok', { status: 200 })
    }) as unknown as typeof fetch

    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk-123', fetchFn })
    await provider.transcribe(audioBlob())

    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-123')
  })

  it('setzt model + response_format und – nur wenn gesetzt – language und prompt', async () => {
    let body: FormData | undefined
    const fetchFn = (async (_u: string, i: RequestInit) => {
      body = i.body as FormData
      return new Response('ok', { status: 200 })
    }) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })

    await provider.transcribe(audioBlob(), {
      language: 'de',
      vocabularyHints: ['Widget', 'Blitztext']
    })

    expect(body?.get('model')).toBe('whisper-1')
    expect(body?.get('response_format')).toBe('text')
    expect(body?.get('language')).toBe('de')
    expect(body?.get('prompt')).toBe('Eigennamen und Begriffe: Widget, Blitztext')
  })

  it('lässt language und prompt weg, wenn nicht gesetzt', async () => {
    let body: FormData | undefined
    const fetchFn = (async (_u: string, i: RequestInit) => {
      body = i.body as FormData
      return new Response('ok', { status: 200 })
    }) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })

    await provider.transcribe(audioBlob())

    expect(body?.get('language')).toBeNull()
    expect(body?.get('prompt')).toBeNull()
  })

  it('wirft ohne API-Key und ruft fetch gar nicht erst auf', async () => {
    let called = false
    const fetchFn = (async () => {
      called = true
      return new Response('', { status: 200 })
    }) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => null, fetchFn })

    await expect(provider.transcribe(audioBlob())).rejects.toThrow(/API-Key/)
    expect(called).toBe(false)
  })

  it('wirft bei Nicht-200 mit der OpenAI-Fehlermeldung', async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ error: { message: 'Ungültiger Key' } }), {
        status: 401
      })) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })

    await expect(provider.transcribe(audioBlob())).rejects.toThrow(/Ungültiger Key/)
  })

  it('wirft bei Netzwerkfehler (fetch wirft) eine klare deutsche Meldung', async () => {
    const fetchFn = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })

    await expect(provider.transcribe(audioBlob())).rejects.toThrow(/Netzwerkfehler/)
  })

  // --- V2 Strang B: Provider-Config (baseUrl + Modell) ---

  it('nutzt baseUrl + Modell aus getConfig und komponiert die URL korrekt', async () => {
    let url: string | undefined
    let body: FormData | undefined
    const fetchFn = (async (u: string, i: RequestInit) => {
      url = u
      body = i.body as FormData
      return new Response('text', { status: 200 })
    }) as unknown as typeof fetch

    const provider = createCloudTranscriptionProvider({
      getApiKey: async () => 'gsk',
      getConfig: () => ({ baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3' }),
      fetchFn
    })
    await provider.transcribe(audioBlob())

    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions')
    expect(body?.get('model')).toBe('whisper-large-v3')
    expect(body?.get('response_format')).toBe('text') // Whisper-Familie
  })

  it('fordert bei nicht-Whisper-Modellen JSON an und parst das text-Feld', async () => {
    let body: FormData | undefined
    const fetchFn = (async (_u: string, i: RequestInit) => {
      body = i.body as FormData
      return new Response(JSON.stringify({ text: '  aus JSON  ' }), { status: 200 })
    }) as unknown as typeof fetch

    const provider = createCloudTranscriptionProvider({
      getApiKey: async () => 'sk',
      getConfig: () => ({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-transcribe' }),
      fetchFn
    })

    expect(await provider.transcribe(audioBlob())).toBe('aus JSON')
    expect(body?.get('response_format')).toBe('json')
  })

  // --- v0.2.x #01: Abbruch-Signal ---

  it('reicht das AbortSignal an fetch weiter', async () => {
    let init: RequestInit | undefined
    const fetchFn = (async (_u: string, i: RequestInit) => {
      init = i
      return new Response('ok', { status: 200 })
    }) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })
    const controller = new AbortController()

    await provider.transcribe(audioBlob(), { signal: controller.signal })

    expect(init?.signal).toBe(controller.signal)
  })

  it('reicht AbortError unverändert weiter (nicht als Netzwerkfehler)', async () => {
    const fetchFn = (async () => {
      throw new DOMException('Aborted', 'AbortError')
    }) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })

    await expect(provider.transcribe(audioBlob())).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('reicht TimeoutError unverändert weiter', async () => {
    const fetchFn = (async () => {
      throw new DOMException('Timed out', 'TimeoutError')
    }) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })

    await expect(provider.transcribe(audioBlob())).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  // --- A1.0: Fehler additiv anreichern (für die Fehler-Art-Klassifikation) ---

  it('reichert Nicht-200-Fehler mit .status und providerCode an', async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ error: { message: 'Quota', code: 'insufficient_quota' } }), {
        status: 429
      })) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })

    await expect(provider.transcribe(audioBlob())).rejects.toMatchObject({
      status: 429,
      providerCode: 'insufficient_quota'
    })
  })

  it('markiert Transport-Fehler mit .transport=true', async () => {
    const fetchFn = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })

    await expect(provider.transcribe(audioBlob())).rejects.toMatchObject({ transport: true })
  })

  it('liest nicht-String-detail typsicher (kein [object Object])', async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ detail: [{ msg: 'bad input' }] }), {
        status: 422
      })) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({ getApiKey: async () => 'sk', fetchFn })

    await expect(provider.transcribe(audioBlob())).rejects.toThrow(/bad input/)
  })

  // --- L1/L2: key-loser lokaler Anbieter (z. B. whisper.cpp/Speaches auf localhost) ---

  it('key-los: wirft nicht und sendet keinen Authorization-Header', async () => {
    let init: RequestInit | undefined
    const fetchFn = (async (_u: string, i: RequestInit) => {
      init = i
      return new Response('lokal ok', { status: 200 })
    }) as unknown as typeof fetch
    const provider = createCloudTranscriptionProvider({
      getApiKey: async () => null,
      erlaubeOhneKey: () => true,
      getConfig: () => ({ baseUrl: 'http://localhost:8000/v1', model: 'whisper-1' }),
      fetchFn
    })

    expect(await provider.transcribe(audioBlob())).toBe('lokal ok')
    expect((init?.headers as Record<string, string>)?.Authorization).toBeUndefined()
  })
})
