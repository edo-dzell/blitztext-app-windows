// Reine Kaltstart-Logik (P1): bestimmt, ob das rote „kein Key"-Banner zu zeigen ist und welche
// Workflows einen Anbieter OHNE Key nutzen (gelbe Warnung). Node-testbar, kein React, kein @/-Alias.
// hatKey ist die HARTE Wahrheit (Vault/apiKey.has) — NICHT apiKeyStatus (das ist nur Recency).

import { aufloeseWorkflowLauf, type AnbieterKonfig } from '@shared/anbieter'
import type { WorkflowDefinition } from '@shared/workflows'

export interface KaltstartEingabe {
  standardAnbieterId: string
  anbieter: AnbieterKonfig[]
  workflows: WorkflowDefinition[]
  /** Hat dieser Anbieter einen hinterlegten Key? (Quelle der Wahrheit = Vault) */
  hatKey: (anbieterId: string) => boolean
}

export interface Kaltstart {
  /** App ist ohne Key des Standard-Anbieters nicht nutzbar → rotes Banner. */
  rot: boolean
  /** Labels von Workflows, deren (aufgelöster) Anbieter keinen Key hat — gelbe Warnung. */
  gelbeWorkflows: string[]
}

export function berechneKaltstart(e: KaltstartEingabe): Kaltstart {
  const rot = !e.hatKey(e.standardAnbieterId)
  const gelbeWorkflows: string[] = []
  for (const w of e.workflows) {
    const lauf = aufloeseWorkflowLauf(w, {
      anbieter: e.anbieter,
      standardAnbieterId: e.standardAnbieterId,
      language: ''
    })
    const aid = lauf.anbieter?.id
    if (!aid) continue
    if (aid === e.standardAnbieterId) continue // schon im roten Banner abgedeckt → kein Doppel
    if (!e.hatKey(aid)) gelbeWorkflows.push(w.label)
  }
  return { rot, gelbeWorkflows }
}
