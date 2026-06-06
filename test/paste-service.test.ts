import { describe, it, expect } from 'vitest'
import { createPasteService, type EinfügeStrategie } from '@main/output/paste-service'

function fakeZwischenablage(initial = '') {
  let inhalt = initial
  return {
    lies: () => inhalt,
    schreib: (t: string) => {
      inhalt = t
    }
  }
}

function strategie(name: 'helfer' | 'powershell', erfolg: boolean) {
  const spy = { name, aufrufe: 0 }
  const s: EinfügeStrategie = {
    name,
    versuch: async () => {
      spy.aufrufe++
      return erfolg
    }
  }
  return { s, spy }
}

describe('createPasteService', () => {
  it('Helfer erfolgreich: Text in die Zwischenablage geschrieben, Helfer versucht, Erfolg', async () => {
    const zwischenablage = fakeZwischenablage('alt')
    const helfer = strategie('helfer', true)
    let hinweise = 0

    const service = createPasteService({
      zwischenablage,
      strategien: [helfer.s],
      zeigeManuellenHinweis: () => {
        hinweise++
      }
    })

    const ergebnis = await service.einfügen('neuer text')

    expect(zwischenablage.lies()).toBe('neuer text')
    expect(helfer.spy.aufrufe).toBe(1)
    expect(ergebnis).toMatchObject({ erfolg: true, strategie: 'helfer' })
    expect(hinweise).toBe(0)
  })

  it('Helfer scheitert → PowerShell erfolgreich (Reihenfolge eingehalten)', async () => {
    const helfer = strategie('helfer', false)
    const powershell = strategie('powershell', true)

    const service = createPasteService({
      zwischenablage: fakeZwischenablage(),
      strategien: [helfer.s, powershell.s],
      zeigeManuellenHinweis: () => {}
    })

    const ergebnis = await service.einfügen('text')

    expect(helfer.spy.aufrufe).toBe(1)
    expect(powershell.spy.aufrufe).toBe(1)
    expect(ergebnis).toMatchObject({ erfolg: true, strategie: 'powershell' })
  })

  it('beide scheitern: Hinweis, kein Erfolg, Text bleibt in der Zwischenablage', async () => {
    const zwischenablage = fakeZwischenablage('alt')
    const helfer = strategie('helfer', false)
    const powershell = strategie('powershell', false)
    let hinweise = 0

    const service = createPasteService({
      zwischenablage,
      strategien: [helfer.s, powershell.s],
      zeigeManuellenHinweis: () => {
        hinweise++
      }
    })

    const ergebnis = await service.einfügen('text')

    expect(ergebnis).toEqual({ erfolg: false })
    expect(hinweise).toBe(1)
    expect(zwischenablage.lies()).toBe('text') // nicht wiederhergestellt — Nutzer kann manuell einfügen
  })

  it('liest die vorherige Zwischenablage vor dem Schreiben; wiederherstellen() stellt sie zurück', async () => {
    const zwischenablage = fakeZwischenablage('vorher')
    const service = createPasteService({
      zwischenablage,
      strategien: [strategie('helfer', true).s],
      zeigeManuellenHinweis: () => {}
    })

    const ergebnis = await service.einfügen('eingefügt')
    expect(zwischenablage.lies()).toBe('eingefügt') // Text liegt zum Einfügen bereit

    if (!ergebnis.erfolg) throw new Error('sollte erfolgreich sein')
    ergebnis.wiederherstellen()
    expect(zwischenablage.lies()).toBe('vorher') // vorheriger Inhalt zurück
  })

  it('wiederherstellen() überschreibt nicht, wenn die Zwischenablage inzwischen geändert wurde', async () => {
    const zwischenablage = fakeZwischenablage('vorher')
    const service = createPasteService({
      zwischenablage,
      strategien: [strategie('helfer', true).s],
      zeigeManuellenHinweis: () => {}
    })

    const ergebnis = await service.einfügen('eingefügt')
    if (!ergebnis.erfolg) throw new Error('sollte erfolgreich sein')

    zwischenablage.schreib('etwas anderes vom Nutzer') // Nutzer kopiert zwischenzeitlich etwas
    ergebnis.wiederherstellen()

    expect(zwischenablage.lies()).toBe('etwas anderes vom Nutzer') // NICHT überschrieben (Inhalts-Guard)
  })
})
