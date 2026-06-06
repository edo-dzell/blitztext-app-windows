// Kuratierte Registry OpenAI-kompatibler Anbieter (ADR-0008, V2 Strang B). Framework-unabhängige
// Domänendaten — Main, Preload, Renderer und Tests teilen dieselbe Quelle. Ein aktiver Anbieter
// liefert BEIDES: Transkription (ASR) UND Umschreiben (Chat), über eine OpenAI-kompatible Base-URL.
//
// Recherche-bestätigt (Stand 2026-06): exakte baseUrls, Modellnamen, Endpoint-Form.
// `response_format=text` unterstützt nur die Whisper-Familie; gpt-4o-transcribe* und Voxtral nur JSON
// (der TranscriptionProvider verzweigt automatisch anhand des Modellnamens).

export interface ModellInfo {
  id: string
  label: string
  empfohlen?: boolean
}

export interface ProviderDescriptor {
  id: string
  label: string
  /** OpenAI-kompatible Base-URL OHNE Trailing-Slash (z. B. 'https://api.openai.com/v1'). */
  baseUrl: string
  asrModelle: ModellInfo[]
  chatModelle: ModellInfo[]
  keyHinweis: string
  docsUrl?: string
  /** true = Nutzer trägt Base-URL/Modelle frei ein ('custom'). */
  anpassbar?: boolean
}

export const PROVIDER: readonly ProviderDescriptor[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    asrModelle: [
      { id: 'whisper-1', label: 'Whisper v1', empfohlen: true },
      { id: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe' },
      { id: 'gpt-4o-mini-transcribe', label: 'GPT-4o mini Transcribe' }
    ],
    chatModelle: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', empfohlen: true },
      { id: 'gpt-4o', label: 'GPT-4o' }
    ],
    keyHinweis: 'sk-…',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    asrModelle: [
      { id: 'whisper-large-v3-turbo', label: 'Whisper large v3 turbo', empfohlen: true },
      { id: 'whisper-large-v3', label: 'Whisper large v3' }
    ],
    chatModelle: [
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B instant', empfohlen: true },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B versatile' }
    ],
    keyHinweis: 'gsk_…',
    docsUrl: 'https://console.groq.com/keys'
  },
  {
    id: 'mistral',
    label: 'Mistral (Voxtral)',
    baseUrl: 'https://api.mistral.ai/v1',
    asrModelle: [{ id: 'voxtral-mini-latest', label: 'Voxtral mini', empfohlen: true }],
    chatModelle: [
      { id: 'mistral-small-latest', label: 'Mistral Small', empfohlen: true },
      { id: 'mistral-large-latest', label: 'Mistral Large' }
    ],
    keyHinweis: 'API-Key',
    docsUrl: 'https://console.mistral.ai/api-keys'
  },
  {
    id: 'custom',
    label: 'Eigener Anbieter (OpenAI-kompatibel)',
    baseUrl: '',
    asrModelle: [],
    chatModelle: [],
    keyHinweis: 'API-Key',
    anpassbar: true
  }
]

export function getProvider(id: string): ProviderDescriptor | undefined {
  return PROVIDER.find((p) => p.id === id)
}

/**
 * ASR- + Chat-Modelle der Registry-Vorlage eines Anbieters — für die Editor-Dropdowns (W-5/S-4).
 * Unbekannte/eigene Vorlage → leere Listen (der Nutzer trägt das Modell frei ein).
 */
export function modelleFuerVorlage(vorlage: string): { asr: ModellInfo[]; chat: ModellInfo[] } {
  const p = getProvider(vorlage)
  return { asr: p?.asrModelle ?? [], chat: p?.chatModelle ?? [] }
}

/**
 * Unterstützt das ASR-Modell `response_format=text`? Nur die Whisper-Familie (OpenAI whisper-1,
 * Groq whisper-large-v3*). gpt-4o-transcribe*, Voxtral und unbekannte Modelle → JSON anfordern und
 * das `text`-Feld parsen. Bewahrt das v1-Verhalten (whisper-1 → text, byte-identisch).
 */
export function asrUnterstuetztTextFormat(model: string): boolean {
  return model.startsWith('whisper')
}
