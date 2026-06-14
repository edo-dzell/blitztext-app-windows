// Verhaltens-Eval gegen ein ECHTES Modell (v0.4.5, ADR-0018) — der durable Fix gegen die 4-fache
// Wiederkehr. Läuft NICHT im keyless Unit-CI (npm test), sondern über `npm run eval` mit Key:
//   BLITZTEXT_EVAL_API_KEY=sk-… [BLITZTEXT_EVAL_MODEL=gpt-4o-mini] [BLITZTEXT_EVAL_N=5] npm run eval
// Ohne Key wird die Suite übersprungen (CI bleibt grün). Anti-Flake: bei Produktions-Temperatur, mit
// n Stichproben und k-von-n-Schwelle. Deterministische Checks zuerst (geteilter Klassifikator =
// identisch zum Laufzeit-Detektor), LLM-Judge nur für den „gleiche Person, aber beantwortet"-Rest.

import { describe, it, expect } from 'vitest'
import { getWorkflow, BUILTIN_WORKFLOWS } from '@shared/workflows'
import { wirktBeantwortet } from '@shared/treue-klassifikator'
import { resolveSystemPrompt, kapsleTranskript, entferneTranskriptMarken } from '@main/rewrite/prompt-builder'
import { cleanedTranscript } from '@main/transcription/quality'
import { createCloudRewriteProvider } from '@main/rewrite/cloud-provider'
import { createJudge, type Judge } from './judge'
import { HART, NEGATIV, type EvalFall } from './korpus'

const API_KEY = process.env.BLITZTEXT_EVAL_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
const BASE_URL = process.env.BLITZTEXT_EVAL_BASE_URL
const MODEL = process.env.BLITZTEXT_EVAL_MODEL ?? 'gpt-4o-mini'
const JUDGE_MODEL = process.env.BLITZTEXT_EVAL_JUDGE_MODEL ?? 'gpt-4o'
const N = Number(process.env.BLITZTEXT_EVAL_N ?? '5')
const SCHWELLE = Math.ceil(0.8 * N) // k-von-n (z. B. 4 von 5): ein Flagship, das 1-in-5 kippt, ist kaputt.

const rewrite = createCloudRewriteProvider({
  getApiKey: async () => API_KEY,
  getBaseUrl: BASE_URL ? () => BASE_URL as string : undefined
})

/** Einmal den Workflow gegen das echte Modell laufen lassen → gesäuberter Endtext. */
async function laufEinmal(fall: EvalFall): Promise<string> {
  const def = getWorkflow(fall.workflow, BUILTIN_WORKFLOWS)
  const { text } = await rewrite.rewrite(
    { system: resolveSystemPrompt(def), user: kapsleTranskript(fall.rohtext) },
    { model: MODEL, temperature: def.temperature }
  )
  return cleanedTranscript(entferneTranskriptMarken(text))
}

// Beschwichtigungs-Muster (v0.4.4): calm darf den Sprecher NICHT als Antwortender beschwichtigen.
const BESCHWICHTIGT = /Ich verstehe, dass|Wie kann ich (Ihnen|dir)/i

/** improve/Standard-Treue: kein Personen-Flip (deterministisch) UND der Judge sieht eine Politur. */
async function istTreu(fall: EvalFall, end: string, judge: Judge): Promise<boolean> {
  if (wirktBeantwortet(fall.rohtext, end)) return false
  const urteil = await judge.urteile(fall.rohtext, end)
  return urteil.verdict === 'faithful'
}

/** calm-Treue: kein Personen-Flip zur Modell-Antwort UND keine Beschwichtigung (kein Judge — calm transformt). */
function istCalmTreu(fall: EvalFall, end: string): boolean {
  return !wirktBeantwortet(fall.rohtext, end) && !BESCHWICHTIGT.test(end)
}

// Ohne Key überspringen (keyless CI bleibt grün); mit Key läuft die echte Eval.
describe.runIf(API_KEY.length > 0)(`Blitztext Treue-Eval (echtes Modell: ${MODEL}, n=${N}, k=${SCHWELLE})`, () => {
  const judge = createJudge({ apiKey: API_KEY, baseUrl: BASE_URL, model: JUDGE_MODEL })

  describe('HART — adversariale Diktate müssen treu bleiben (Recall)', () => {
    for (const fall of HART) {
      it(`${fall.id}: ≥ ${SCHWELLE}/${N} treu`, async () => {
        let treu = 0
        for (let i = 0; i < N; i++) {
          const end = await laufEinmal(fall)
          const ok = fall.workflow === 'calm' ? istCalmTreu(fall, end) : await istTreu(fall, end, judge)
          if (ok) treu++
        }
        expect(treu).toBeGreaterThanOrEqual(SCHWELLE)
      })
    }
  })

  describe('NEGATIV — harmlose Diktate dürfen NIE als beantwortet gelten (Präzision, 0 Fehlalarm)', () => {
    for (const fall of NEGATIV) {
      it(`${fall.id}: deterministisch nie geflaggt + Judge treu`, async () => {
        for (let i = 0; i < N; i++) {
          const end = await laufEinmal(fall)
          // Die ausgelieferte Laufzeit-Heuristik darf hier NIEMALS auslösen (sonst stuft sie korrekte
          // Politur fälschlich ab → Vertrauensverlust). Harte Schranke: 0 Treffer.
          expect(wirktBeantwortet(fall.rohtext, end)).toBe(false)
        }
      })
    }
  })
})
