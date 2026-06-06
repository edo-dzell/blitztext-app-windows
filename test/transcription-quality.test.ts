import { describe, it, expect } from 'vitest'
import {
  shouldRejectRecording,
  cleanedTranscript,
  rohtextAus
} from '@main/transcription/quality'

describe('shouldRejectRecording', () => {
  it('verwirft Aufnahmen unter 0,3 s und akzeptiert sie ab 0,3 s', () => {
    expect(shouldRejectRecording(0.29)).toBe(true)
    expect(shouldRejectRecording(0.3)).toBe(false)
    expect(shouldRejectRecording(1.2)).toBe(false)
  })
})

describe('cleanedTranscript', () => {
  it('entfernt umgebende Leerzeichen und Zeilenumbrüche', () => {
    expect(cleanedTranscript('  hallo welt \n')).toBe('hallo welt')
    expect(cleanedTranscript('\n\n  text  ')).toBe('text')
  })
})

describe('rohtextAus', () => {
  it('liefert den gesäuberten Rohtext (raw rein, getrimmt raus)', () => {
    expect(rohtextAus('  hallo welt \n', 2)).toBe('hallo welt')
    expect(rohtextAus('\n\n  Das ist ein ganz normaler Satz.  ', 2)).toBe(
      'Das ist ein ganz normaler Satz.'
    )
    expect(rohtextAus('Kurz', 0.4)).toBe('Kurz') // kurzes, aber gültiges Wort bei kurzer Dauer
  })

  it('verwirft leeren oder reinen Whitespace-Text (null)', () => {
    expect(rohtextAus('', 2)).toBeNull()
    expect(rohtextAus('   \n  ', 2)).toBeNull()
  })

  it('verwirft Text ohne einen einzigen Buchstaben (null)', () => {
    expect(rohtextAus('123 456', 2)).toBeNull()
    expect(rohtextAus('!!! ...', 2)).toBeNull()
  })

  it('verwirft sehr kurze Aufnahmen (< 0,55 s) mit zu viel Inhalt', () => {
    expect(rohtextAus('eins zwei drei vier fünf', 0.5)).toBeNull() // ≥ 5 Wörter
    expect(rohtextAus('a'.repeat(32), 0.5)).toBeNull() // ≥ 32 Zeichen
    expect(rohtextAus('eins zwei drei vier fünf', 0.55)).toBe('eins zwei drei vier fünf') // Grenze 0,55
  })

  it('verwirft kurze Aufnahmen (< 0,8 s) mit sehr langem Text', () => {
    const long = 'a '.repeat(40).trim() // 79 Zeichen
    expect(rohtextAus(long, 0.7)).toBeNull()
    expect(rohtextAus(long, 0.8)).toBe(long) // Grenze 0,8 greift nicht mehr
  })
})
