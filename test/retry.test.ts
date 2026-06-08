import { describe, it, expect } from 'vitest'
import { mitRetry } from '@main/workflow/retry'

const sofort = async (): Promise<void> => {}

describe('mitRetry', () => {
  it('Sofort-Erfolg: ruft fn genau einmal', async () => {
    let n = 0
    const r = await mitRetry(
      async () => {
        n++
        return 'ok'
      },
      { versuche: 3, backoffMs: 1, retrybar: () => true, sleep: sofort }
    )
    expect(r).toBe('ok')
    expect(n).toBe(1)
  })

  it('transient → Erfolg: wiederholt, bis es klappt', async () => {
    let n = 0
    const r = await mitRetry(
      async () => {
        n++
        if (n < 2) throw new Error('transient')
        return 'ok'
      },
      { versuche: 3, backoffMs: 1, retrybar: () => true, sleep: sofort }
    )
    expect(r).toBe('ok')
    expect(n).toBe(2)
  })

  it('dauerhaft → Fehler nach erschöpften Versuchen', async () => {
    let n = 0
    await expect(
      mitRetry(
        async () => {
          n++
          throw new Error('weg')
        },
        { versuche: 2, backoffMs: 1, retrybar: () => true, sleep: sofort }
      )
    ).rejects.toThrow('weg')
    expect(n).toBe(2)
  })

  it('nicht retrybar → wirft sofort ohne Wiederholung', async () => {
    let n = 0
    await expect(
      mitRetry(
        async () => {
          n++
          throw new Error('konfig')
        },
        { versuche: 3, backoffMs: 1, retrybar: () => false, sleep: sofort }
      )
    ).rejects.toThrow('konfig')
    expect(n).toBe(1)
  })
})
