import { describe, it, expect } from 'vitest'
import {
  BUILTIN_WORKFLOWS,
  getWorkflow,
  findWorkflow,
  TEMPERATUR_STUFEN,
  NEUER_WORKFLOW_TEMPERATUR,
  istGueltigerSprachcode,
  WORKFLOW_VERHALTENS_FELDER,
  werksVerhalten,
  weichtVomWerkAb,
  type WorkflowDefinition
} from '@shared/workflows'

const improve = BUILTIN_WORKFLOWS.find((w) => w.id === 'improve') as WorkflowDefinition

describe('Workflow-Registry', () => {
  it('kennt genau die vier eingebauten Blitztext-Workflows in fester Reihenfolge', () => {
    expect(BUILTIN_WORKFLOWS.map((workflow) => workflow.id)).toEqual([
      'transcribe',
      'improve',
      'calm',
      'emoji'
    ])
  })

  it('markiert nur die Umschreibe-Workflows als rewrites', () => {
    expect(getWorkflow('transcribe', BUILTIN_WORKFLOWS).rewrites).toBe(false)
    expect(getWorkflow('improve', BUILTIN_WORKFLOWS).rewrites).toBe(true)
    expect(getWorkflow('calm', BUILTIN_WORKFLOWS).rewrites).toBe(true)
    expect(getWorkflow('emoji', BUILTIN_WORKFLOWS).rewrites).toBe(true)
  })

  it('bewahrt das v1-Routing in den Seeds (Modell/Temperatur byte-identisch)', () => {
    const improve = getWorkflow('improve', BUILTIN_WORKFLOWS)
    const emoji = getWorkflow('emoji', BUILTIN_WORKFLOWS)
    const calm = getWorkflow('calm', BUILTIN_WORKFLOWS)
    expect({ model: improve.model, temperature: improve.temperature }).toEqual({
      model: 'gpt-4o-mini',
      temperature: 0.3
    })
    expect({ model: emoji.model, temperature: emoji.temperature }).toEqual({
      model: 'gpt-4o-mini',
      temperature: 0.3
    })
    expect({ model: calm.model, temperature: calm.temperature }).toEqual({
      model: 'gpt-4o',
      temperature: 0.4
    })
  })

  it('alle eingebauten Umschreibe-Workflows haben ein nicht-leeres Modell', () => {
    for (const w of BUILTIN_WORKFLOWS) {
      if (w.rewrites) expect(w.model).not.toBe('')
    }
  })

  it('getWorkflow wirft bei unbekannter Id, findWorkflow liefert undefined', () => {
    expect(() => getWorkflow('does-not-exist', BUILTIN_WORKFLOWS)).toThrow(/Unbekannter Workflow/)
    expect(findWorkflow('does-not-exist', BUILTIN_WORKFLOWS)).toBeUndefined()
  })

  // --- v0.2.4 #19: Temperatur-Stufen + Sprachcode-Validierung ---
  it('Temperatur-Stufen enthalten die Built-in-Werte und den Default', () => {
    expect([...TEMPERATUR_STUFEN]).toEqual([0, 0.2, 0.3, 0.4, 0.7, 1.0])
    expect(TEMPERATUR_STUFEN).toContain(NEUER_WORKFLOW_TEMPERATUR)
    for (const w of BUILTIN_WORKFLOWS) {
      expect(TEMPERATUR_STUFEN).toContain(w.temperature)
    }
  })

  it('Sprachcode-Validierung akzeptiert ISO-639-1, lehnt anderes ab', () => {
    expect(istGueltigerSprachcode('de')).toBe(true)
    expect(istGueltigerSprachcode('en')).toBe(true)
    expect(istGueltigerSprachcode('')).toBe(false)
    expect(istGueltigerSprachcode('deu')).toBe(false)
    expect(istGueltigerSprachcode('DE')).toBe(false)
    expect(istGueltigerSprachcode('german')).toBe(false)
  })
})

// --- P3: Werks-Reset (nur Verhalten; Anbieter/Sprache bleiben) ---
describe('Werks-Reset (P3)', () => {
  it('WORKFLOW_VERHALTENS_FELDER = die Verhaltensfelder (inkl. ausgabeSprache, ohne anbieterId/language)', () => {
    expect([...WORKFLOW_VERHALTENS_FELDER]).toEqual([
      'rewrites',
      'promptModus',
      'systemPrompt',
      'model',
      'temperature',
      'tone',
      'emojiDensity',
      'ausgabeSprache'
    ])
  })

  it('ausgabeSprache zählt als Abweichung (R1), language/anbieterId weiterhin nicht', () => {
    expect(weichtVomWerkAb({ ...improve, ausgabeSprache: 'en' })).toBe(true)
    expect(weichtVomWerkAb({ ...improve, ausgabeSprache: '' })).toBe(false) // leer == Werk
    expect(weichtVomWerkAb({ ...improve, language: 'en', anbieterId: 'groq' })).toBe(false)
  })

  it('werksVerhalten liefert die Verhaltensfelder eines Builtins, undefined sonst', () => {
    expect(werksVerhalten('improve')).toMatchObject({
      rewrites: true,
      promptModus: 'berechnet',
      model: 'gpt-4o-mini',
      temperature: 0.3
    })
    expect(werksVerhalten('eigener-flow')).toBeUndefined()
  })

  it('weichtVomWerkAb: false unverändert, true bei Verhaltensänderung', () => {
    expect(weichtVomWerkAb({ ...improve })).toBe(false)
    expect(weichtVomWerkAb({ ...improve, temperature: 0.9 })).toBe(true)
    expect(weichtVomWerkAb({ ...improve, promptModus: 'statisch', systemPrompt: 'X' })).toBe(true)
  })

  it('eigener Workflow weicht NIE ab (kein Reset)', () => {
    expect(weichtVomWerkAb({ ...improve, builtin: false, temperature: 0.9 })).toBe(false)
  })

  it('Anbieter-/Sprachänderung zählt NICHT als Abweichung (bleibt erhalten)', () => {
    expect(weichtVomWerkAb({ ...improve, anbieterId: 'groq', language: 'en' })).toBe(false)
  })
})
