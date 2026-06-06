import { describe, it, expect } from 'vitest'
import { createStatsStore, type StatsFile } from '@main/stats/stats-store'

function fakeFile(): StatsFile & { content: string | null } {
  const f = {
    content: null as string | null,
    async read() {
      return f.content
    },
    async write(next: string) {
      f.content = next
    }
  }
  return f
}

// 2026-06-05 12:00 UTC
const T = Date.UTC(2026, 5, 5, 12, 0, 0)

describe('createStatsStore', () => {
  it('aggregiert mehrere Läufe desselben Tags/Workflows/Modells', async () => {
    const store = createStatsStore({ file: fakeFile() })
    await store.aufzeichnen({ workflowId: 'transcribe', audioSekunden: 10, asrModell: 'whisper-1' }, T)
    await store.aufzeichnen({ workflowId: 'transcribe', audioSekunden: 20, asrModell: 'whisper-1' }, T)
    const s = await store.zusammenfassung()
    expect(s.zeilen).toHaveLength(1)
    expect(s.zeilen[0].anzahl).toBe(2)
    expect(s.zeilen[0].audioSekunden).toBe(30)
    expect(s.gesamtAnzahl).toBe(2)
  })

  it('summiert Eingabe-/Ausgabe-Token je Zeile und gesamt (P7)', async () => {
    const store = createStatsStore({ file: fakeFile() })
    await store.aufzeichnen(
      {
        workflowId: 'improve',
        audioSekunden: 60,
        asrModell: 'whisper-1',
        chat: { model: 'gpt-4o-mini', promptTokens: 1_000_000, completionTokens: 250_000 }
      },
      T
    )
    const s = await store.zusammenfassung()
    expect(s.zeilen[0].promptTokens).toBe(1_000_000)
    expect(s.zeilen[0].completionTokens).toBe(250_000)
    expect(s.gesamtPromptTokens).toBe(1_000_000)
    expect(s.gesamtCompletionTokens).toBe(250_000)
  })

  it('addiert Token-Summen über mehrere Zeilen (verschiedene Workflows)', async () => {
    const store = createStatsStore({ file: fakeFile() })
    await store.aufzeichnen(
      { workflowId: 'improve', audioSekunden: 1, asrModell: 'whisper-1', chat: { model: 'gpt-4o-mini', promptTokens: 100, completionTokens: 40 } },
      T
    )
    await store.aufzeichnen(
      { workflowId: 'calm', audioSekunden: 1, asrModell: 'whisper-1', chat: { model: 'gpt-4o', promptTokens: 200, completionTokens: 60 } },
      T
    )
    const s = await store.zusammenfassung()
    expect(s.gesamtPromptTokens).toBe(300)
    expect(s.gesamtCompletionTokens).toBe(100)
  })

  it('trennt verschiedene Tage', async () => {
    const store = createStatsStore({ file: fakeFile() })
    const T2 = Date.UTC(2026, 5, 6, 9, 0, 0)
    await store.aufzeichnen({ workflowId: 't', audioSekunden: 5, asrModell: 'whisper-1' }, T)
    await store.aufzeichnen({ workflowId: 't', audioSekunden: 5, asrModell: 'whisper-1' }, T2)
    const s = await store.zusammenfassung()
    expect(s.zeilen.map((z) => z.datum).sort()).toEqual(['2026-06-05', '2026-06-06'])
  })

  it('persistiert KEINEN Text (nur Zahlen/Modellnamen)', async () => {
    const file = fakeFile()
    const store = createStatsStore({ file })
    await store.aufzeichnen(
      {
        workflowId: 'improve',
        audioSekunden: 3,
        asrModell: 'whisper-1',
        chat: { model: 'gpt-4o-mini', promptTokens: 5, completionTokens: 7 }
      },
      T
    )
    expect(file.content).not.toBeNull()
    // Schlüssel sind rein numerisch/Modellnamen; keine Roh-/Endtext-Felder.
    expect(file.content).not.toContain('rohtext')
    expect(file.content).not.toContain('endtext')
  })

  it('löschen leert die Statistik', async () => {
    const store = createStatsStore({ file: fakeFile() })
    await store.aufzeichnen({ workflowId: 't', audioSekunden: 5, asrModell: 'whisper-1' }, T)
    await store.loeschen()
    expect((await store.zusammenfassung()).zeilen).toEqual([])
  })
})
