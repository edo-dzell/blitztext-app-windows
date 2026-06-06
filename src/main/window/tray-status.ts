// Tray-Status (#08/#11): spiegelt die Workflow-Phase der Sitzung in den Tray-Tooltip.
// phaseTooltip ist rein (testbar); spiegleStatus ist die dünne Electron-Anbindung (HITL).

import type { Tray } from 'electron'
import type { WorkflowPhase } from '@main/workflow/runner'

/** Phase → Tooltip-Text. Rein, damit der Wortlaut ohne Electron testbar ist. */
export function phaseTooltip(phase: WorkflowPhase): string {
  switch (phase.status) {
    case 'idle':
      return 'Blitztext'
    case 'aufnehmen':
      return 'Blitztext — Aufnahme …'
    case 'transkribieren':
      return 'Blitztext — Transkribiere …'
    case 'umschreiben':
      return 'Blitztext — Schreibe um …'
    case 'fertig':
      return 'Blitztext — Fertig'
    case 'fehler':
      return `Blitztext — Fehler: ${phase.message}`
  }
}

/** An `Sitzung.onStatus` hängen: Tray-Tooltip aktualisieren. */
export function spiegleStatus(tray: Tray, phase: WorkflowPhase): void {
  tray.setToolTip(phaseTooltip(phase))
}
