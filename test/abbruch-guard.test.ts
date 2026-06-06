import { describe, it, expect } from 'vitest'
import { istAbbruchOderTimeout } from '@main/session/abbruch-guard'

describe('istAbbruchOderTimeout', () => {
  it('true für AbortError', () => {
    expect(istAbbruchOderTimeout(new DOMException('x', 'AbortError'))).toBe(true)
  })

  it('true für TimeoutError', () => {
    expect(istAbbruchOderTimeout(new DOMException('x', 'TimeoutError'))).toBe(true)
  })

  it('true, wenn die cause ein AbortError ist', () => {
    const err = new Error('wrapper', { cause: new DOMException('x', 'AbortError') })
    expect(istAbbruchOderTimeout(err)).toBe(true)
  })

  it('false für echte Fehler (müssen eskalieren, nicht verschluckt werden)', () => {
    expect(istAbbruchOderTimeout(new TypeError('echter Bug'))).toBe(false)
    expect(istAbbruchOderTimeout(new Error('Anbieter-Fehler: 500'))).toBe(false)
  })

  it('false für nicht-Error-Gründe', () => {
    expect(istAbbruchOderTimeout('abort')).toBe(false)
    expect(istAbbruchOderTimeout(null)).toBe(false)
    expect(istAbbruchOderTimeout(undefined)).toBe(false)
  })
})
