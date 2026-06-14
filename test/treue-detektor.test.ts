import { describe, it, expect } from 'vitest'
import { personProfil, wirktBeantwortet } from '@shared/treue-klassifikator'
import { createTreueDetektor } from '@main/rewrite/treue-detektor'

// v0.4.5 (ADR-0018): deterministischer Treue-Klassifikator/-Detektor gegen „Modell beantwortet das
// Diktat statt es zu bearbeiten" (Personen-Flip du→ich). Auf PRÄZISION getunt: Negativ-Kontrollen
// dürfen NIE auslösen (sonst stuft die App korrekte Politur fälschlich ab).

describe('personProfil', () => {
  it('zählt 1.- und 2.-Person-Marker und ignoriert Wörter wie „Meinung"', () => {
    expect(personProfil('ich gebe dir mein Wort')).toEqual({ erste: 2, zweite: 1 }) // ich, mein | dir
    // „Meinung" darf NICHT als „mein" zählen (exakte Wortgrenzen).
    expect(personProfil('Das ist meine Meinung')).toEqual({ erste: 1, zweite: 0 })
    // Lowercase „sie" (3. Person) zählt nicht; formelles „Sie" schon.
    expect(personProfil('sie kamen alle')).toEqual({ erste: 0, zweite: 0 })
    expect(personProfil('Können Sie mir helfen')).toEqual({ erste: 1, zweite: 1 }) // mir | Sie
  })
})

describe('wirktBeantwortet — der reale 14.6.2026-Fall', () => {
  const roh =
    'nichts umsetzen, sondern mir nur eine Empfehlung geben, wie du ohne eine neue Regel hättest, ' +
    'das entsprechend so verarbeiten können, dass du direkt weißt, dass es eine neue E-Mail gibt.'
  const falscherEndtext =
    'Ich hätte die E-Mail so verarbeitet, dass ich direkt erkenne, dass es sich um eine neue ' +
    'E-Mail handelt, ohne eine neue Regel einführen zu müssen.'
  const treuerEndtext =
    'Setze nichts um, sondern gib mir nur eine Empfehlung, wie du das ohne eine neue Regel so ' +
    'hättest verarbeiten können, dass du direkt weißt, dass es eine neue E-Mail gibt.'

  it('erkennt den Personen-Flip du→ich als „beantwortet"', () => {
    expect(wirktBeantwortet(roh, falscherEndtext)).toBe(true)
  })

  it('lässt die TREUE Politur (Anrede bleibt „du") in Ruhe', () => {
    expect(wirktBeantwortet(roh, treuerEndtext)).toBe(false)
  })
})

describe('wirktBeantwortet — Negativ-Kontrollen (dürfen NIE auslösen)', () => {
  const faelle: Array<[string, string]> = [
    // 1.-Person-Erzählung, leicht poliert — kein Gegenüber, kein Flip.
    ['ähm ich geh morgen ins büro und kümmer mich um die rechnung', 'Ich gehe morgen ins Büro und kümmere mich um die Rechnung.'],
    // Bitte an „du" — Anrede bleibt erhalten.
    ['kannst du mir bitte das protokoll schicken', 'Kannst du mir bitte das Protokoll schicken?'],
    // Formelle Bitte — „Sie" bleibt „Sie".
    ['können sie mir den bericht bis morgen zusenden', 'Können Sie mir den Bericht bis morgen zusenden?'],
    // Imperativ ohne Anrede-Pronomen — Personen-Achse kann nicht kippen.
    ['bitte schick mir den bericht bis freitag', 'Bitte schicke mir den Bericht bis Freitag.'],
    // Reine Sachaussage ohne Personen.
    ['das meeting ist um drei verschoben worden', 'Das Meeting wurde auf drei Uhr verschoben.']
  ]
  for (const [roh, end] of faelle) {
    it(`kein Fehlalarm: „${roh.slice(0, 32)}…"`, () => {
      expect(wirktBeantwortet(roh, end)).toBe(false)
    })
  }
})

describe('createTreueDetektor', () => {
  it('delegiert an den geteilten Klassifikator (identische Entscheidung wie eval/)', () => {
    const d = createTreueDetektor()
    expect(d.wirktBeantwortet('frag du mal nach', 'Ich frage nach.')).toBe(true)
    expect(d.wirktBeantwortet('ich frage nach', 'Ich frage nach.')).toBe(false)
  })
})
