// Phase → Status-Pille (ADR-0007/0009). Rein/testbar; die Anzeige (fokusfreies Overlay) ist HITL.
import type { WorkflowPhase } from '@main/workflow/runner'

export interface PillenStatus {
  sichtbar: boolean
  label: string
}

export function pillenStatus(phase: WorkflowPhase): PillenStatus {
  switch (phase.status) {
    case 'aufnehmen':
      return { sichtbar: true, label: '🎙 Aufnahme …' }
    case 'transkribieren':
      return { sichtbar: true, label: '⏳ Transkribiere …' }
    case 'umschreiben':
      return { sichtbar: true, label: '✍️ Schreibe um …' }
    case 'fehler':
      return { sichtbar: true, label: `⚠️ ${phase.message}` }
    case 'idle':
    case 'fertig':
      return { sichtbar: false, label: '' }
  }
}
