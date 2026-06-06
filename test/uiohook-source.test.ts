import { describe, it, expect, vi } from 'vitest'
import { starteUiohookQuelle, type UiohookQuelle } from '@main/hotkey/uiohook-source'
import type { UiohookKeyboardEvent } from 'uiohook-napi'

// Fake-Hook: sammelt Listener, erlaubt manuelles Feuern; zählt start/stop.
function fakeHook() {
  const listeners: Record<string, ((e: UiohookKeyboardEvent) => void)[]> = { keydown: [], keyup: [] }
  let started = 0
  let stopped = 0
  const hook: UiohookQuelle = {
    on(event, listener) {
      listeners[event].push(listener)
      return hook
    },
    start() {
      started++
    },
    stop() {
      stopped++
    }
  }
  const feuere = (event: 'keydown' | 'keyup', keycode: number): void => {
    for (const l of listeners[event]) l({ keycode } as UiohookKeyboardEvent)
  }
  return { hook, feuere, get started() { return started }, get stopped() { return stopped } }
}

describe('starteUiohookQuelle', () => {
  it('mappt keydown/keyup-Keycodes auf KeyEvents (DOM-Namen) und startet den Hook', () => {
    const f = fakeHook()
    const verarbeiteTaste = vi.fn()
    starteUiohookQuelle({ verarbeiteTaste, hook: f.hook })

    expect(f.started).toBe(1)
    f.feuere('keydown', 0x0e1d) // ControlRight
    f.feuere('keydown', 0x0036) // ShiftRight
    f.feuere('keyup', 0x0036)

    expect(verarbeiteTaste).toHaveBeenNthCalledWith(1, { type: 'down', key: 'ControlRight' })
    expect(verarbeiteTaste).toHaveBeenNthCalledWith(2, { type: 'down', key: 'ShiftRight' })
    expect(verarbeiteTaste).toHaveBeenNthCalledWith(3, { type: 'up', key: 'ShiftRight' })
  })

  it('verwirft ungemappte Keycodes', () => {
    const f = fakeHook()
    const verarbeiteTaste = vi.fn()
    starteUiohookQuelle({ verarbeiteTaste, hook: f.hook })
    f.feuere('keydown', 0xffff)
    expect(verarbeiteTaste).not.toHaveBeenCalled()
  })

  it('der Stopp-Thunk stoppt den Hook', () => {
    const f = fakeHook()
    const stop = starteUiohookQuelle({ verarbeiteTaste: vi.fn(), hook: f.hook })
    stop()
    expect(f.stopped).toBe(1)
  })
})
