import { describe, it, expect } from 'vitest'
import {
  aufloeseWorkflowLauf,
  anbieterAusProvider,
  findeAnbieter,
  type AnbieterKonfig
} from '@shared/anbieter'
import { BUILTIN_WORKFLOWS, getWorkflow } from '@shared/workflows'

const OPENAI: AnbieterKonfig = {
  id: 'openai',
  vorlage: 'openai',
  label: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  asrModell: 'whisper-1',
  chatModell: 'gpt-4o-mini'
}
const GROQ: AnbieterKonfig = {
  id: 'groq',
  vorlage: 'groq',
  label: 'Groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  asrModell: 'whisper-large-v3-turbo',
  chatModell: 'llama-3.1-8b-instant'
}

describe('aufloeseWorkflowLauf', () => {
  it('nimmt den gepinnten Workflow-Anbieter (Override vor Standard)', () => {
    const w = { anbieterId: 'groq', model: 'eigenes-modell', temperature: 0.7 }
    const lauf = aufloeseWorkflowLauf(w, {
      anbieter: [OPENAI, GROQ],
      standardAnbieterId: 'openai',
      language: 'de'
    })
    expect(lauf.anbieter.id).toBe('groq')
    expect(lauf.baseUrl).toBe('https://api.groq.com/openai/v1')
    expect(lauf.asrModell).toBe('whisper-large-v3-turbo')
    expect(lauf.chatModell).toBe('eigenes-modell') // Workflow-Modell schlägt Anbieter-Default
    expect(lauf.language).toBe('de')
  })

  it('erbt den Standard-Anbieter, wenn der Workflow keinen pinnt', () => {
    const lauf = aufloeseWorkflowLauf(
      { anbieterId: '', model: '', temperature: 0.3 },
      { anbieter: [OPENAI, GROQ], standardAnbieterId: 'groq', language: 'en' }
    )
    expect(lauf.anbieter.id).toBe('groq')
    expect(lauf.chatModell).toBe('llama-3.1-8b-instant') // model '' → Anbieter-Default
  })

  it('fällt auf den Standard-Anbieter zurück, wenn die anbieterId ins Leere zeigt (gelöscht)', () => {
    const lauf = aufloeseWorkflowLauf(
      { anbieterId: 'geloescht', model: '', temperature: 0 },
      { anbieter: [OPENAI], standardAnbieterId: 'openai', language: 'de' }
    )
    expect(lauf.anbieter.id).toBe('openai')
  })

  // --- BYTE-IDENTITÄTS-WÄCHTER: die vier Built-ins bei Werkseinstellungen (OpenAI-Default) ---
  it('löst die vier Built-ins byte-identisch zu v1 auf (Snapshot)', () => {
    const ctx = { anbieter: [OPENAI], standardAnbieterId: 'openai', language: 'de' }
    const snapshot = BUILTIN_WORKFLOWS.map((w) => {
      const l = aufloeseWorkflowLauf(w, ctx)
      return {
        id: w.id,
        anbieter: l.anbieter.id,
        baseUrl: l.baseUrl,
        asrModell: l.asrModell,
        chatModell: l.chatModell,
        temperature: l.temperature,
        language: l.language
      }
    })
    expect(snapshot).toEqual([
      { id: 'transcribe', anbieter: 'openai', baseUrl: 'https://api.openai.com/v1', asrModell: 'whisper-1', chatModell: 'gpt-4o-mini', temperature: 0, language: 'de' },
      { id: 'improve', anbieter: 'openai', baseUrl: 'https://api.openai.com/v1', asrModell: 'whisper-1', chatModell: 'gpt-4o-mini', temperature: 0.3, language: 'de' },
      { id: 'calm', anbieter: 'openai', baseUrl: 'https://api.openai.com/v1', asrModell: 'whisper-1', chatModell: 'gpt-4o', temperature: 0.4, language: 'de' },
      { id: 'emoji', anbieter: 'openai', baseUrl: 'https://api.openai.com/v1', asrModell: 'whisper-1', chatModell: 'gpt-4o-mini', temperature: 0.3, language: 'de' }
    ])
  })

  it('fällt auf das Anbieter-Standardmodell zurück, wenn ein FREMDES Modell gepinnt ist (kein Absturz)', () => {
    const MISTRAL: AnbieterKonfig = {
      id: 'mistral',
      vorlage: 'mistral',
      label: 'Mistral',
      baseUrl: 'https://api.mistral.ai/v1',
      asrModell: 'voxtral-mini-latest',
      chatModell: 'mistral-small-latest'
    }
    // 'gpt-4o-mini' (OpenAI-Modell) gegen Mistral → ungültig → Mistral-Standardmodell statt Absturz.
    const lauf = aufloeseWorkflowLauf(
      { anbieterId: 'mistral', model: 'gpt-4o-mini', temperature: 0.3 },
      { anbieter: [MISTRAL], standardAnbieterId: 'mistral', language: 'de' }
    )
    expect(lauf.chatModell).toBe('mistral-small-latest')
    // Ein frei eingegebenes (keiner Vorlage bekanntes) Modell bleibt dagegen respektiert.
    const frei = aufloeseWorkflowLauf(
      { anbieterId: 'mistral', model: 'mein-eigenes-modell', temperature: 0.3 },
      { anbieter: [MISTRAL], standardAnbieterId: 'mistral', language: 'de' }
    )
    expect(frei.chatModell).toBe('mein-eigenes-modell')
  })

  it('Built-ins bleiben auf OpenAI gepinnt, auch wenn der Standard auf Groq wechselt', () => {
    const ctx = { anbieter: [OPENAI, GROQ], standardAnbieterId: 'groq', language: 'de' }
    const calm = aufloeseWorkflowLauf(getWorkflow('calm', BUILTIN_WORKFLOWS), ctx)
    // calm pinnt anbieterId 'openai' UND model 'gpt-4o' → unverändert trotz Groq-Standard.
    expect(calm.anbieter.id).toBe('openai')
    expect(calm.chatModell).toBe('gpt-4o')
  })

  // --- #19: Pro-Workflow-Override für Sprache + ASR-Modell ---
  it('Workflow-Override für Sprache und ASR-Modell schlägt die Vererbung', () => {
    const lauf = aufloeseWorkflowLauf(
      { anbieterId: '', model: '', temperature: 0.3, language: 'en', asrModell: 'gpt-4o-transcribe' },
      { anbieter: [OPENAI], standardAnbieterId: 'openai', language: 'de' }
    )
    expect(lauf.language).toBe('en')
    expect(lauf.asrModell).toBe('gpt-4o-transcribe')
  })

  it('leere Overrides erben (Sprache global, ASR vom Anbieter)', () => {
    const lauf = aufloeseWorkflowLauf(
      { anbieterId: '', model: '', temperature: 0.3, language: '', asrModell: '' },
      { anbieter: [OPENAI], standardAnbieterId: 'openai', language: 'de' }
    )
    expect(lauf.language).toBe('de')
    expect(lauf.asrModell).toBe('whisper-1')
  })
})

describe('anbieterAusProvider', () => {
  it('leitet eine Anbieter-Konfig aus dem Single-Provider-Feld ab (bekannte Vorlage)', () => {
    const a = anbieterAusProvider({
      id: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      asrModell: 'whisper-large-v3',
      chatModell: 'llama-3.1-8b-instant'
    })
    expect(a).toMatchObject({ id: 'groq', vorlage: 'groq', label: 'Groq' })
  })

  it('unbekannte Id → Vorlage custom', () => {
    const a = anbieterAusProvider({ id: 'eigenes', baseUrl: 'https://x', asrModell: 'm', chatModell: 'c' })
    expect(a.vorlage).toBe('custom')
    expect(a.label).toBe('eigenes')
  })
})

describe('findeAnbieter', () => {
  it('findet nach id, sonst undefined', () => {
    expect(findeAnbieter([OPENAI, GROQ], 'groq')?.id).toBe('groq')
    expect(findeAnbieter([OPENAI], 'fehlt')).toBeUndefined()
  })
})
