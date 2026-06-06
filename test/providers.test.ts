import { describe, it, expect } from 'vitest'
import {
  PROVIDER,
  getProvider,
  asrUnterstuetztTextFormat,
  modelleFuerVorlage
} from '@shared/providers'

describe('Provider-Registry', () => {
  it('enthält OpenAI, Groq, Mistral und custom', () => {
    expect(PROVIDER.map((p) => p.id)).toEqual(['openai', 'groq', 'mistral', 'custom'])
  })

  it('liefert per id den Descriptor, sonst undefined', () => {
    expect(getProvider('openai')?.baseUrl).toBe('https://api.openai.com/v1')
    expect(getProvider('groq')?.baseUrl).toBe('https://api.groq.com/openai/v1')
    expect(getProvider('unbekannt')).toBeUndefined()
  })

  it('Base-URLs haben keinen Trailing-Slash (außer custom = leer)', () => {
    for (const p of PROVIDER) {
      if (p.anpassbar) continue
      expect(p.baseUrl.endsWith('/')).toBe(false)
      expect(p.baseUrl).not.toBe('')
    }
  })

  it('custom ist anpassbar und hat leere Felder', () => {
    const custom = getProvider('custom')!
    expect(custom.anpassbar).toBe(true)
    expect(custom.baseUrl).toBe('')
    expect(custom.asrModelle).toEqual([])
  })

  it('asrUnterstuetztTextFormat: nur Whisper-Familie kann response_format=text', () => {
    expect(asrUnterstuetztTextFormat('whisper-1')).toBe(true)
    expect(asrUnterstuetztTextFormat('whisper-large-v3')).toBe(true)
    expect(asrUnterstuetztTextFormat('whisper-large-v3-turbo')).toBe(true)
    expect(asrUnterstuetztTextFormat('gpt-4o-transcribe')).toBe(false)
    expect(asrUnterstuetztTextFormat('voxtral-mini-latest')).toBe(false)
  })

  // --- v0.2.4 #20: Modell-Registry-Mapping für die Editor-Dropdowns ---
  it('modelleFuerVorlage liefert ASR- + Chat-Modelle des Anbieters', () => {
    const openai = modelleFuerVorlage('openai')
    expect(openai.asr.map((m) => m.id)).toContain('whisper-1')
    expect(openai.chat.map((m) => m.id)).toContain('gpt-4o-mini')
  })

  it('modelleFuerVorlage: unbekannte/eigene Vorlage → leere Listen', () => {
    expect(modelleFuerVorlage('custom')).toEqual({ asr: [], chat: [] })
    expect(modelleFuerVorlage('unbekannt')).toEqual({ asr: [], chat: [] })
  })
})
