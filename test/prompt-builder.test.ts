import { describe, it, expect } from 'vitest'
import {
  buildSystemPrompt,
  resolveSystemPrompt,
  wandleAufStatisch,
  stelleBerechnetWieder
} from '@main/rewrite/prompt-builder'
import { BUILTIN_WORKFLOWS, getWorkflow, type WorkflowDefinition } from '@shared/workflows'

describe('buildSystemPrompt', () => {
  it('liefert für calm den festen Dampf-Ablassen-Prompt', () => {
    const prompt = buildSystemPrompt('calm')
    expect(prompt).toContain('Gib NUR die fertige Nachricht zurück')
    expect(prompt).toContain('ruhig, menschlich, bestimmt')
  })

  it('liefert für improve den Lektor-Default', () => {
    const prompt = buildSystemPrompt('improve')
    expect(prompt).toContain('Du bist ein Lektor und Schreibassistent')
    expect(prompt).toContain('Gib NUR den verbesserten Text zurück')
  })

  it('ergänzt für improve die passende Ton-Zeile', () => {
    expect(buildSystemPrompt('improve', { tone: 'formal' })).toContain('formellen, professionellen Ton')
    expect(buildSystemPrompt('improve', { tone: 'neutral' })).toContain('neutralen, klaren Ton')
    expect(buildSystemPrompt('improve', { tone: 'casual' })).toContain('lockeren, natürlichen Ton')
  })

  it('hängt für improve die Eigene-Begriffe-Zeile an', () => {
    const prompt = buildSystemPrompt('improve', { customTerms: ['Widget', 'Blitztext'] })
    expect(prompt).toContain(
      'Diese Eigennamen und Fachbegriffe müssen exakt so geschrieben werden: Widget, Blitztext'
    )
  })

  it('hängt für improve den Kontext an', () => {
    const prompt = buildSystemPrompt('improve', { context: 'IT-Support-Ticket' })
    expect(prompt).toContain('Kontext: IT-Support-Ticket')
  })

  it('erzeugt für emoji die Dichte-Anweisung im Emoji-Rahmen', () => {
    expect(buildSystemPrompt('emoji', { emojiDensity: 'wenig' })).toContain('maximal 1-2 pro Absatz')
    expect(buildSystemPrompt('emoji', { emojiDensity: 'mittel' })).toContain('etwa alle 1-2 Sätze')
    expect(buildSystemPrompt('emoji', { emojiDensity: 'viel' })).toContain('mehrere pro Satz')
    expect(buildSystemPrompt('emoji', { emojiDensity: 'mittel' })).toContain(
      'Gib NUR den Text mit Emojis zurück'
    )
  })

  it('wirft für transcribe (kein Umschreibe-Schritt)', () => {
    expect(() => buildSystemPrompt('transcribe')).toThrow()
  })
})

describe('resolveSystemPrompt (V2 Strang C)', () => {
  it('berechnet: ist für alle eingebauten Umschreibe-Workflows byte-identisch zu buildSystemPrompt', () => {
    const settings = { tone: 'formal' as const, emojiDensity: 'viel' as const }
    for (const def of BUILTIN_WORKFLOWS) {
      if (!def.rewrites) continue
      expect(resolveSystemPrompt(def, settings)).toBe(buildSystemPrompt(def.id, settings))
    }
  })

  it('statisch: liefert den gespeicherten Prompt-Text unverändert', () => {
    const def: WorkflowDefinition = {
      id: 'mein-flow',
      label: 'Mein Flow',
      summary: '',
      builtin: false,
      rewrites: true,
      promptModus: 'statisch',
      systemPrompt: 'Antworte als Pirat.',
      model: '',
      temperature: 0.3
    }
    expect(resolveSystemPrompt(def)).toBe('Antworte als Pirat.')
  })

  it('statisch: hängt Eigene Begriffe als Zeile an', () => {
    const def: WorkflowDefinition = {
      id: 'x',
      label: 'x',
      summary: '',
      builtin: false,
      rewrites: true,
      promptModus: 'statisch',
      systemPrompt: 'Basis.',
      model: '',
      temperature: 0.3
    }
    const prompt = resolveSystemPrompt(def, { customTerms: ['Acme', 'GmbH'] })
    expect(prompt).toContain('Basis.')
    expect(prompt).toContain(
      'Diese Eigennamen und Fachbegriffe müssen exakt so geschrieben werden: Acme, GmbH'
    )
  })

  it('berechnet für calm reicht den festen Prompt durch (über die Definition)', () => {
    const calm = getWorkflow('calm', BUILTIN_WORKFLOWS)
    expect(resolveSystemPrompt(calm)).toContain('Gib NUR die fertige Nachricht zurück')
  })
})

describe('Built-in-Prompt-Edit (#24)', () => {
  it('wandleAufStatisch füllt den statischen Prompt mit dem berechneten Text', () => {
    const improve = getWorkflow('improve', BUILTIN_WORKFLOWS)
    const statisch = wandleAufStatisch(improve, { tone: 'formal' })
    expect(statisch.promptModus).toBe('statisch')
    expect(statisch.systemPrompt).toBe(buildSystemPrompt('improve', { tone: 'formal' }))
  })

  it('ein bereits statischer Workflow bleibt unverändert', () => {
    const eigen: WorkflowDefinition = {
      id: 'x',
      label: 'X',
      summary: '',
      builtin: false,
      rewrites: true,
      promptModus: 'statisch',
      systemPrompt: 'fest',
      model: '',
      temperature: 0.3
    }
    expect(wandleAufStatisch(eigen)).toBe(eigen)
  })

  it('stelleBerechnetWieder macht einen Built-in wieder byte-identisch (Restore)', () => {
    const improve = getWorkflow('improve', BUILTIN_WORKFLOWS)
    const bearbeitet = wandleAufStatisch(improve)
    const zurueck = stelleBerechnetWieder(bearbeitet)
    expect(zurueck.promptModus).toBe('berechnet')
    expect(resolveSystemPrompt(zurueck, { tone: 'casual' })).toBe(
      buildSystemPrompt('improve', { tone: 'casual' })
    )
  })
})

describe('Ausgabesprache (R1)', () => {
  const improve = getWorkflow('improve', BUILTIN_WORKFLOWS)

  it('hängt den Zielsprachen-Block ans Ende (berechnet); Basis-Prompt bleibt davor', () => {
    const p = resolveSystemPrompt({ ...improve, ausgabeSprache: 'en' })
    expect(p.startsWith(buildSystemPrompt('improve'))).toBe(true)
    expect(p).toContain('AUSSCHLIESSLICH auf Englisch')
  })

  it('hängt nichts an, wenn ausgabeSprache leer/fehlt (byte-identisch)', () => {
    expect(resolveSystemPrompt({ ...improve, ausgabeSprache: '' })).toBe(buildSystemPrompt('improve'))
    expect(resolveSystemPrompt(improve)).toBe(buildSystemPrompt('improve'))
  })

  it('wirkt auch bei statischem Prompt', () => {
    const def: WorkflowDefinition = {
      id: 'x',
      label: 'x',
      summary: '',
      builtin: false,
      rewrites: true,
      promptModus: 'statisch',
      systemPrompt: 'Basis.',
      model: '',
      temperature: 0.3,
      ausgabeSprache: 'de'
    }
    const p = resolveSystemPrompt(def)
    expect(p).toContain('Basis.')
    expect(p).toContain('AUSSCHLIESSLICH auf Deutsch')
  })

  it('unbekannter Sprachcode wird direkt verwendet', () => {
    expect(resolveSystemPrompt({ ...improve, ausgabeSprache: 'fr' })).toContain(
      'AUSSCHLIESSLICH auf fr'
    )
  })

  it('buildSystemPrompt bleibt von ausgabeSprache unberührt (kein Block)', () => {
    expect(buildSystemPrompt('improve')).not.toContain('AUSSCHLIESSLICH auf')
  })
})
