// Reine Zustandsmaschine: aus synthetischen Tasten-Down/Up + Aufnahmemodus + Chord → start/stop/cancel.
// Treue Portierung von HotkeyService.swift, an uiohooks diskrete Down/Up-Events angepasst (statt
// macOS' flagsChanged). Keine uiohook-Abhängigkeit — die Ereignisquelle liegt hinter einem Adapter.

export type RecordingMode = 'hold' | 'toggle'
export type HotkeyAction = 'start' | 'stop' | 'cancel'

export interface KeyEvent {
  type: 'down' | 'up'
  key: string
}

export interface HotkeyMatcherConfig {
  chord: string[]
  mode: RecordingMode
}

export interface HotkeyMatcher {
  handle(event: KeyEvent): HotkeyAction | null
}

export function createHotkeyMatcher(config: HotkeyMatcherConfig): HotkeyMatcher {
  const chord = new Set(config.chord)
  const pressed = new Set<string>()
  let active = false

  const chordComplete = (): boolean => {
    for (const key of chord) {
      if (!pressed.has(key)) return false
    }
    return true
  }

  return {
    handle(event) {
      // Escape ist der feste Abbruch-Key (HotkeyService.handleEscape, keyCode 53).
      if (event.key === 'Escape') {
        if (event.type === 'down' && active) {
          active = false
          return 'cancel'
        }
        return null
      }

      if (!chord.has(event.key)) return null

      const wasComplete = chordComplete()
      if (event.type === 'down') pressed.add(event.key)
      else pressed.delete(event.key)
      const isComplete = chordComplete()

      const risingEdge = !wasComplete && isComplete
      const fallingEdge = wasComplete && !isComplete

      if (config.mode === 'hold') {
        if (risingEdge && !active) {
          active = true
          return 'start'
        }
        if (fallingEdge && active) {
          active = false
          return 'stop'
        }
        return null
      }

      // toggle: nur die steigende Flanke schaltet um, Loslassen tut nichts
      if (risingEdge) {
        active = !active
        return active ? 'start' : 'stop'
      }
      return null
    }
  }
}
