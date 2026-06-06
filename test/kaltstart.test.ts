import { describe, it, expect } from 'vitest'
import { berechneKaltstart } from '@renderer/lib/kaltstart'
import type { AnbieterKonfig } from '@shared/anbieter'
import type { WorkflowDefinition } from '@shared/workflows'

const anb = (id: string): AnbieterKonfig => ({
  id,
  vorlage: 'openai',
  label: id,
  baseUrl: '',
  asrModell: '',
  chatModell: ''
})
const wf = (id: string, anbieterId?: string): WorkflowDefinition => ({
  id,
  label: id,
  summary: '',
  builtin: false,
  rewrites: true,
  promptModus: 'statisch',
  systemPrompt: '',
  model: '',
  temperature: 0.3,
  ...(anbieterId ? { anbieterId } : {})
})

describe('berechneKaltstart (P1)', () => {
  it('rot, wenn der Standard-Anbieter keinen Key hat', () => {
    const r = berechneKaltstart({
      standardAnbieterId: 'openai',
      anbieter: [anb('openai')],
      workflows: [],
      hatKey: () => false
    })
    expect(r.rot).toBe(true)
  })

  it('nicht rot mit Key', () => {
    const r = berechneKaltstart({
      standardAnbieterId: 'openai',
      anbieter: [anb('openai')],
      workflows: [],
      hatKey: () => true
    })
    expect(r.rot).toBe(false)
  })

  it('gelbe Liste: Workflow mit Anbieter ohne Key (≠ Standard)', () => {
    const r = berechneKaltstart({
      standardAnbieterId: 'openai',
      anbieter: [anb('openai'), anb('groq')],
      workflows: [wf('A', 'groq'), wf('B', 'openai')],
      hatKey: (id) => id === 'openai'
    })
    expect(r.rot).toBe(false)
    expect(r.gelbeWorkflows).toEqual(['A']) // B nutzt Standard (Key da); A nutzt groq (kein Key)
  })

  it('Workflow ohne anbieterId erbt Standard → kein gelbes Doppel, wenn Standard rot', () => {
    const r = berechneKaltstart({
      standardAnbieterId: 'openai',
      anbieter: [anb('openai')],
      workflows: [wf('A')],
      hatKey: () => false
    })
    expect(r.rot).toBe(true)
    expect(r.gelbeWorkflows).toEqual([])
  })

  it('leer, wenn alle Keys vorhanden sind', () => {
    const r = berechneKaltstart({
      standardAnbieterId: 'openai',
      anbieter: [anb('openai'), anb('groq')],
      workflows: [wf('A', 'groq')],
      hatKey: () => true
    })
    expect(r.rot).toBe(false)
    expect(r.gelbeWorkflows).toEqual([])
  })
})
