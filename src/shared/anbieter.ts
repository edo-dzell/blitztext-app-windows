// Auflösungsnaht für den Workflow-Lauf (v0.2.3, ADR-0010). Framework-unabhängig + rein → der
// zentrale Ort, an dem „welcher Anbieter / welche Modelle für diesen Lauf" entschieden wird.
// Reihenfolge: Workflow-Override → Anbieter-/Global-Default; verwaiste Zuordnung → Standard-Anbieter.
// Der Byte-Identitäts-Snapshot über die vier Built-ins (siehe Test) wacht über Verhaltensgleichheit.

import { getProvider, modelleFuerVorlage, PROVIDER } from '@shared/providers'

export interface AnbieterKonfig {
  id: string
  /** Welche Registry-Vorlage (openai/groq/mistral/custom). */
  vorlage: string
  label: string
  /** OpenAI-kompatible Base-URL OHNE Trailing-Slash. */
  baseUrl: string
  asrModell: string
  chatModell: string
  /** L1: lokaler/keyloser Anbieter (z. B. whisper.cpp/Speaches auf localhost) — kein API-Key nötig,
   *  kein Authorization-Header. Fehlt/false = Key wie üblich erforderlich. */
  keinKeyNoetig?: boolean
}

export interface LaufKontext {
  anbieter: readonly AnbieterKonfig[]
  standardAnbieterId: string
  language: string
}

/** Was ein Workflow zur Auflösung beiträgt (Teilmenge der WorkflowDefinition). */
export interface AufloesbarerWorkflow {
  anbieterId?: string
  model: string
  temperature: number
  /** Override Sprache (v0.2.4); '' / fehlt = erbt global. */
  language?: string
}

export interface AufgeloesterLauf {
  anbieter: AnbieterKonfig
  baseUrl: string
  asrModell: string
  chatModell: string
  temperature: number
  language: string
}

export function findeAnbieter(
  liste: readonly AnbieterKonfig[],
  id: string
): AnbieterKonfig | undefined {
  return liste.find((a) => a.id === id)
}

/** Leitet eine Anbieter-Konfig aus dem v1/v2.0-Single-Provider-Feld ab (Migration/Übergang). */
export function anbieterAusProvider(p: {
  id: string
  baseUrl: string
  asrModell: string
  chatModell: string
}): AnbieterKonfig {
  const descriptor = getProvider(p.id)
  return {
    id: p.id,
    vorlage: descriptor ? descriptor.id : 'custom',
    label: descriptor?.label ?? p.id,
    baseUrl: p.baseUrl,
    asrModell: p.asrModell,
    chatModell: p.chatModell
  }
}

/**
 * Löst einen Workflow-Lauf gegen die Anbieter-Liste auf. Built-ins pinnen `anbieterId` (OpenAI) und
 * `model` (Chat); das ASR-Modell und die Sprache werden geerbt. Verwaiste `anbieterId` → Standard.
 */
/**
 * Effektives Chat-Modell des Laufs. Leer → Anbieter-Standard (vererbt). Ist das gepinnte Modell ein
 * Modell, das einem ANDEREN bekannten Anbieter gehört (z. B. OpenAI-Modell gegen Mistral), ist es für
 * diesen Anbieter ungültig → Anbieter-Standard (verhindert den Absturz). Ein FREI/eigen eingegebenes
 * Modell (keiner Registry-Vorlage bekannt) bleibt respektiert.
 */
export function aufgeloestesChatModell(model: string, anbieter: AnbieterKonfig): string {
  if (!model) return anbieter.chatModell
  if (modelleFuerVorlage(anbieter.vorlage).chat.some((m) => m.id === model)) return model
  const gehoertAnderem = PROVIDER.some(
    (p) => p.id !== anbieter.vorlage && p.chatModelle.some((m) => m.id === model)
  )
  return gehoertAnderem ? anbieter.chatModell : model
}

export function aufloeseWorkflowLauf(
  workflow: AufloesbarerWorkflow,
  ctx: LaufKontext
): AufgeloesterLauf {
  const anbieter =
    (workflow.anbieterId ? findeAnbieter(ctx.anbieter, workflow.anbieterId) : undefined) ??
    findeAnbieter(ctx.anbieter, ctx.standardAnbieterId) ??
    ctx.anbieter[0]

  return {
    anbieter,
    baseUrl: anbieter.baseUrl,
    // A6/D9: KEIN Pro-Workflow-ASR-Override mehr — die Transkription nutzt ohnehin das Anbieter-ASR-Modell;
    // so protokolliert der Verlauf ehrlich, was wirklich lief (ADR-0016).
    asrModell: anbieter.asrModell,
    chatModell: aufgeloestesChatModell(workflow.model, anbieter),
    temperature: workflow.temperature,
    language: workflow.language || ctx.language
  }
}
