import { describe, it, expect } from 'vitest'
import { enterDarfBestaetigen } from '@renderer/lib/dialog-enter'

describe('enterDarfBestaetigen', () => {
  it('harmloser Dialog: Enter bestätigt', () => {
    expect(enterDarfBestaetigen(false)).toBe(true)
  })

  it('destruktiver Dialog: Enter bestätigt NICHT (kein versehentliches Löschen)', () => {
    expect(enterDarfBestaetigen(true)).toBe(false)
  })
})
