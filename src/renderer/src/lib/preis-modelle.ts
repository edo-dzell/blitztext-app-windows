// Welche Modell-Ids der Preis-Editor (Statistik) anbietet. Reine, framework-unabhängige Logik →
// headless testbar. Behebt: der Editor listete bisher nur die PREISE-Defaults (OpenAI/Groq), sodass
// Mistral & konfigurierte Anbieter keine Preis-Felder hatten und deren Kosten als „—" erschienen.
//
// Quelle der Liste = Vereinigung aus:
//   1) Default-Tabelle PREISE (nach Feldtyp: ASR vs. Chat),
//   2) Katalog-Modelle ALLER konfigurierten Anbieter (modelleFuerVorlage → klare ASR/Chat-Trennung)
//      plus deren frei eingetragene asrModell/chatModell (custom-Anbieter),
//   3) bereits gesetzte Override-Keys (nach gesetztem Feld eingeordnet).

import type { AnbieterKonfig } from '@shared/anbieter'
import { modelleFuerVorlage } from '@shared/providers'
import { PREISE, type PreisOverrides } from '@shared/pricing'

export interface PreisModellListen {
  /** Modell-Ids mit ASR-Preis (pro Audiominute). */
  asr: string[]
  /** Modell-Ids mit Chat-Preis (pro Token). */
  chat: string[]
}

export function preisModellListen(
  anbieter: readonly AnbieterKonfig[] = [],
  overrides: PreisOverrides = {}
): PreisModellListen {
  const asr = new Set<string>()
  const chat = new Set<string>()

  // 1) Default-Tabelle nach Feldtyp klassifizieren.
  for (const [id, p] of Object.entries(PREISE)) {
    if (p.asrProMinuteUsd !== undefined) asr.add(id)
    if (p.inputPro1MUsd !== undefined) chat.add(id)
  }

  // 2) Katalog-Modelle der konfigurierten Anbieter (ASR/Chat-Trennung aus der Registry-Vorlage)
  //    plus frei eingetragene Modelle (custom-Anbieter haben leere Kataloge).
  for (const a of anbieter) {
    const m = modelleFuerVorlage(a.vorlage)
    for (const x of m.asr) asr.add(x.id)
    for (const x of m.chat) chat.add(x.id)
    if (a.asrModell) asr.add(a.asrModell)
    if (a.chatModell) chat.add(a.chatModell)
  }

  // 3) Bestehende Override-Keys nach gesetztem Feld einordnen (falls nicht schon enthalten).
  for (const [id, ov] of Object.entries(overrides)) {
    if (ov.asrProMinuteUsd !== undefined) asr.add(id)
    if (ov.inputPro1MUsd !== undefined || ov.outputPro1MUsd !== undefined) chat.add(id)
  }

  return { asr: [...asr], chat: [...chat] }
}
