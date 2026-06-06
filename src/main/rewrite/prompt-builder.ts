// Baut den System-Prompt je Umschreibe-Workflow aus den Einstellungen.
// Treue Portierung der Prompts aus LLMService.swift (reine Logik).

import type { WorkflowId, WorkflowDefinition } from '@shared/workflows'

export interface RewriteSettings {
  tone?: 'formal' | 'neutral' | 'casual'
  customTerms?: string[]
  context?: string
  emojiDensity?: 'aus' | 'wenig' | 'mittel' | 'viel'
}

const DAMPF_ABLASSEN_PROMPT =
  'Du erhältst ein emotional gesprochenes Transkript. Erkenne zuerst das eigentliche Ziel, ' +
  'Anliegen und den wahren Frust der Person. Formuliere daraus eine klare, respektvolle und ' +
  'wirksame Nachricht, mit der die Person ihr Ziel eher erreicht. Bewahre relevante Fakten, ' +
  'konkrete Probleme, Grenzen, Erwartungen und die nötige Dringlichkeit. Entferne Beleidigungen, ' +
  'Drohungen, Sarkasmus, Unterstellungen und unnötige Eskalation. Wenn mehrere Vorwürfe genannt ' +
  'werden, verdichte sie auf die entscheidenden Kernpunkte. Der Ton soll ruhig, menschlich, ' +
  'bestimmt und lösungsorientiert sein. Gib NUR die fertige Nachricht zurück.'

const IMPROVE_BASE = [
  'Du bist ein Lektor und Schreibassistent. Verbessere den folgenden Text:',
  '- Korrigiere Rechtschreibung und Grammatik',
  '- Verbessere die Formulierung und den Lesefluss',
  '- Behalte die ursprüngliche Bedeutung bei',
  '- Gib NUR den verbesserten Text zurück, keine Erklärungen'
].join('\n')

export function buildSystemPrompt(workflow: WorkflowId, settings: RewriteSettings = {}): string {
  switch (workflow) {
    case 'calm':
      return DAMPF_ABLASSEN_PROMPT
    case 'improve':
      return buildImprovePrompt(settings)
    case 'emoji':
      return buildEmojiPrompt(settings)
    default:
      throw new Error(`Kein Umschreibe-Prompt für Workflow: ${workflow}`)
  }
}

// V2 (Strang C): Auflösung des System-Prompts für einen beliebigen Workflow.
// - 'berechnet' (die vier eingebauten) → exakt der v1-Builder anhand der Id (Verhalten unverändert).
// - 'statisch' (nutzer-definiert/bearbeitet) → der gespeicherte Prompt-Text; Eigene Begriffe werden,
//   falls vorhanden, als Zeile angehängt (dieselbe Formulierung wie bei improve).
// Ausgabesprache-Block (R1): ans ENDE gehängt, damit er dominiert. Nur bei gesetzter ausgabeSprache.
const SPRACHNAMEN: Record<string, string> = { de: 'Deutsch', en: 'Englisch' }
function zielsprachenBlock(code: string): string {
  const sprache = SPRACHNAMEN[code] ?? code
  return (
    `Gib deine Antwort AUSSCHLIESSLICH auf ${sprache} aus, auch wenn die Eingabe in einer anderen ` +
    'Sprache verfasst ist. Übersetze den Inhalt sinngemäß; Eigennamen nicht übersetzen; keine ' +
    'Mischsprache, keine Hinweise zur Übersetzung.'
  )
}

/**
 * Der berechnete Basis-Prompt eines eingebauten Workflows (mit pro-Workflow Ton/Emoji-Merge), OHNE
 * die Ausgabesprache-Zeile (die hängt resolveSystemPrompt zur Laufzeit separat an). Genutzt für die
 * read-only-Anzeige UND die „Bearbeiten"-Vorbefüllung (R2/#10) → beide zeigen denselben Text.
 */
export function berechneterPrompt(def: WorkflowDefinition, settings: RewriteSettings = {}): string {
  return buildSystemPrompt(def.id, {
    ...settings,
    tone: def.tone || settings.tone,
    emojiDensity: def.emojiDensity || settings.emojiDensity
  })
}

export function resolveSystemPrompt(
  def: WorkflowDefinition,
  settings: RewriteSettings = {}
): string {
  let prompt: string
  if (def.promptModus === 'berechnet') {
    prompt = berechneterPrompt(def, settings)
  } else {
    prompt = def.systemPrompt
    if (settings.customTerms && settings.customTerms.length > 0) {
      prompt +=
        '\n\nWichtig: Diese Eigennamen und Fachbegriffe müssen exakt so geschrieben werden: ' +
        settings.customTerms.join(', ')
    }
  }
  // R1: Zielsprache zuletzt anhängen (gilt für berechnete UND statische Prompts).
  if (def.ausgabeSprache && def.ausgabeSprache.trim() !== '') {
    prompt += '\n\n' + zielsprachenBlock(def.ausgabeSprache)
  }
  return prompt
}

// --- v0.2.5 #24: Built-in-Prompt-Edit (berechnet ↔ statisch) ---

/**
 * Wandelt einen Workflow auf einen STATISCHEN Prompt um, vorbefüllt mit dem aktuell aufgelösten Text
 * (Built-in: der berechnete Prompt). So sieht der Nutzer beim Bearbeiten den bisherigen Inhalt. Ein
 * bereits statischer Workflow bleibt unverändert.
 */
export function wandleAufStatisch(
  def: WorkflowDefinition,
  settings: RewriteSettings = {}
): WorkflowDefinition {
  if (def.promptModus === 'statisch') return def
  // R2: Vorbefüllung == read-only-Anzeige (berechneterPrompt inkl. pro-Workflow Ton/Emoji-Merge).
  // Die Ausgabesprache bleibt separat (eigenes Feld, zur Laufzeit angehängt) → kein Doppel.
  return { ...def, promptModus: 'statisch', systemPrompt: berechneterPrompt(def, settings) }
}

/**
 * Stellt den berechneten (dynamischen) Standard-Prompt eines eingebauten Workflows wieder her →
 * der Workflow ist danach wieder byte-identisch zu v1 („Standard zurücksetzen", W-8/#24).
 */
export function stelleBerechnetWieder(def: WorkflowDefinition): WorkflowDefinition {
  return { ...def, promptModus: 'berechnet', systemPrompt: '' }
}

const TONE_LINES: Record<NonNullable<RewriteSettings['tone']>, string> = {
  formal: '- Verwende einen formellen, professionellen Ton',
  neutral: '- Verwende einen neutralen, klaren Ton',
  casual: '- Verwende einen lockeren, natürlichen Ton'
}

function buildImprovePrompt(settings: RewriteSettings): string {
  let prompt = IMPROVE_BASE
  prompt += '\n' + TONE_LINES[settings.tone ?? 'neutral']

  if (settings.customTerms && settings.customTerms.length > 0) {
    prompt +=
      '\n\nWichtig: Diese Eigennamen und Fachbegriffe müssen exakt so geschrieben werden: ' +
      settings.customTerms.join(', ')
  }

  if (settings.context && settings.context.trim() !== '') {
    prompt += '\n\nKontext: ' + settings.context.trim()
  }

  return prompt
}

const DENSITY_INSTRUCTIONS: Record<'wenig' | 'mittel' | 'viel', string> = {
  wenig: 'Setze nur vereinzelt Emojis ein, maximal 1-2 pro Absatz.',
  mittel: 'Setze regelmäßig passende Emojis ein, etwa alle 1-2 Sätze.',
  viel: 'Setze großzügig Emojis ein, gerne mehrere pro Satz.'
}

function buildEmojiPrompt(settings: RewriteSettings): string {
  const dichte = settings.emojiDensity ?? 'mittel'
  if (dichte === 'aus') {
    return (
      'Du erhältst ein gesprochenes Transkript. Gib den Text möglichst originalgetreu zurück, OHNE ' +
      'Emojis. Korrigiere offensichtliche Sprach- und Grammatikfehler. Behalte den Stil und die ' +
      'Bedeutung bei. Gib NUR den Text zurück, keine Erklärungen.'
    )
  }
  return (
    'Du erhältst ein gesprochenes Transkript. Gib den Text möglichst originalgetreu zurück, aber ' +
    `füge passende Emojis ein. ${DENSITY_INSTRUCTIONS[dichte]} Korrigiere offensichtliche Sprach- und ` +
    'Grammatikfehler. Behalte den Stil und die Bedeutung bei. Gib NUR den Text mit Emojis zurück, keine Erklärungen.'
  )
}
