import { describe, it, expect } from 'vitest'
import { buildAssistentAnfrage, buildAssistentVerbesserung } from '@main/rewrite/assistent'

describe('buildAssistentAnfrage', () => {
  it('baut system + user und trägt die Beschreibung getrimmt in den user-Teil', () => {
    const { system, user } = buildAssistentAnfrage('  formell auf Englisch  ')
    expect(system).toContain('System-Prompt')
    expect(system).toContain('NUR den fertigen')
    expect(user).toContain('formell auf Englisch')
    expect(user).not.toContain('  formell') // getrimmt
  })
})

describe('buildAssistentVerbesserung (#25)', () => {
  it('verbessert einen bestehenden Prompt: beide Texte landen im user-Teil', () => {
    const { system, user } = buildAssistentVerbesserung('Alter Prompt.', 'kürzer machen')
    expect(system).toContain('verbesserst einen BESTEHENDEN')
    expect(user).toContain('Alter Prompt.')
    expect(user).toContain('kürzer machen')
  })

  it('fällt ohne bestehenden Prompt auf „neu erstellen" zurück', () => {
    const neu = buildAssistentVerbesserung('   ', 'formell auf Englisch')
    expect(neu).toEqual(buildAssistentAnfrage('formell auf Englisch'))
  })
})
