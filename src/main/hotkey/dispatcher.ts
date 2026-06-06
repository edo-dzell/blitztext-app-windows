// Multi-Chord-Dispatch (#06): komponiert die reinen Einzel-Chord-Matcher und ordnet jedem Chord
// einen Workflow zu. Arbitriert „ein Workflow zur Zeit" (wie macOS HotkeyService.activeCombo):
// solange einer aktiv ist, werden andere Chords ignoriert; nur sein stop/cancel beendet ihn.
// Hinweis: Chords sollten sich nicht überlappen (kein Subset eines anderen) — bei diskreten
// Down-Events komplettiert sonst der kürzere zuerst und sperrt den längeren. Die Defaults (#06b)
// sind bewusst disjunkt.

import {
  createHotkeyMatcher,
  type HotkeyMatcher,
  type KeyEvent,
  type RecordingMode
} from '@main/hotkey/matcher'
import type { WorkflowId } from '@shared/workflows'

export interface Bindung {
  chord: string[]
  workflow: WorkflowId
}

export interface HotkeyDispatcherConfig {
  bindungen: Bindung[]
  mode: RecordingMode
}

export interface DispatchAktion {
  aktion: 'start' | 'stop' | 'cancel'
  workflow: WorkflowId
}

export interface HotkeyDispatcher {
  handle(event: KeyEvent): DispatchAktion | null
}

export function createHotkeyDispatcher(config: HotkeyDispatcherConfig): HotkeyDispatcher {
  const eintraege = config.bindungen.map((bindung) => ({
    workflow: bindung.workflow,
    matcher: createHotkeyMatcher({ chord: bindung.chord, mode: config.mode })
  }))
  let aktiv: { workflow: WorkflowId; matcher: HotkeyMatcher } | null = null

  return {
    handle(event) {
      // Alle Matcher fortschreiben, damit ihr Tasten-Tracking akkurat bleibt.
      const treffer = eintraege.map((e) => ({ ...e, aktion: e.matcher.handle(event) }))

      if (aktiv) {
        const aktiverMatcher = aktiv.matcher
        const eigener = treffer.find((t) => t.matcher === aktiverMatcher)
        if (eigener && (eigener.aktion === 'stop' || eigener.aktion === 'cancel')) {
          const workflow = aktiv.workflow
          aktiv = null
          return { aktion: eigener.aktion, workflow }
        }
        return null // ein Workflow aktiv → andere Auslösungen ignorieren
      }

      const gestartet = treffer.find((t) => t.aktion === 'start')
      if (!gestartet) return null
      aktiv = { workflow: gestartet.workflow, matcher: gestartet.matcher }
      return { aktion: 'start', workflow: gestartet.workflow }
    }
  }
}
