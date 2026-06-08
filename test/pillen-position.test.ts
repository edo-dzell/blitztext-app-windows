import { describe, it, expect } from 'vitest'
import { pillenPosition } from '@main/window/pillen-position'

describe('pillenPosition', () => {
  it('zentriert horizontal und setzt die Pille an den unteren Rand der Arbeitsfläche', () => {
    const p = pillenPosition({ x: 0, y: 0, width: 1000, height: 800 }, { width: 200, height: 40 })
    expect(p.x).toBe(400) // (1000-200)/2
    expect(p.y).toBe(800 - 40 - 12) // unten, 12px Luft
  })

  it('berücksichtigt den Offset eines zweiten Displays', () => {
    const p = pillenPosition({ x: 1920, y: 0, width: 1000, height: 800 }, { width: 200, height: 40 })
    expect(p.x).toBe(1920 + 400)
    expect(p.y).toBe(800 - 40 - 12)
  })

  it('klemmt eine zu große/zu randnahe Pille in die sichtbaren Bounds (kein off-screen)', () => {
    const p = pillenPosition({ x: 0, y: 0, width: 100, height: 50 }, { width: 200, height: 80 })
    expect(p.x).toBe(0) // nicht negativ
    expect(p.y).toBe(0)
  })
})
