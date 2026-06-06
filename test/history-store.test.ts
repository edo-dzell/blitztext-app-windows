import { describe, it, expect } from 'vitest'
import { createVerlaufStore, type VerlaufEintrag } from '@main/history/history-store'
import type { SecretCipher, CiphertextFile } from '@main/secrets/api-key-store'

// Fake-Cipher: „verschlüsselt" durch Markierung (umkehrbar), damit der Roundtrip prüfbar ist.
function fakeCipher(available = true): SecretCipher {
  return {
    isEncryptionAvailable: () => available,
    async encrypt(plain) {
      return new TextEncoder().encode('ENC:' + plain)
    },
    async decrypt(data) {
      const s = new TextDecoder().decode(data)
      if (!s.startsWith('ENC:')) throw new Error('kaputt')
      return s.slice(4)
    }
  }
}

function fakeFile(): CiphertextFile & { data: Uint8Array | null } {
  const f = {
    data: null as Uint8Array | null,
    async read() {
      return f.data
    },
    async write(d: Uint8Array) {
      f.data = d
    },
    async remove() {
      f.data = null
    }
  }
  return f
}

function eintrag(id: string): VerlaufEintrag {
  return {
    id,
    zeitstempelMs: 1000,
    workflowId: 'transcribe',
    workflowLabel: 'Blitztext',
    rohtext: 'roh ' + id,
    endtext: 'end ' + id,
    dauerSekunden: 1.2
  }
}

describe('createVerlaufStore', () => {
  it('zeichnet nichts auf, wenn inaktiv', async () => {
    const file = fakeFile()
    const store = createVerlaufStore({ cipher: fakeCipher(), file, istAktiv: () => false })
    expect(await store.aufzeichnen(eintrag('a'))).toBe(false) // P5b: nichts geschrieben → false
    expect(file.data).toBeNull()
    expect(await store.liste()).toEqual([])
  })

  it('verschlüsselter Roundtrip: aufzeichnen → liste (neueste zuerst)', async () => {
    const file = fakeFile()
    const store = createVerlaufStore({ cipher: fakeCipher(), file, istAktiv: () => true })
    expect(await store.aufzeichnen(eintrag('a'))).toBe(true) // P5b: geschrieben → true
    await store.aufzeichnen(eintrag('b'))
    expect(file.data).not.toBeNull()
    const liste = await store.liste()
    expect(liste.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('wahrt die Retentionsgrenze (neueste behalten)', async () => {
    const file = fakeFile()
    const store = createVerlaufStore({ cipher: fakeCipher(), file, istAktiv: () => true, maxEintraege: 2 })
    await store.aufzeichnen(eintrag('a'))
    await store.aufzeichnen(eintrag('b'))
    await store.aufzeichnen(eintrag('c'))
    const liste = await store.liste()
    expect(liste.map((e) => e.id)).toEqual(['c', 'b'])
  })

  it('löschen entfernt die Datei', async () => {
    const file = fakeFile()
    const store = createVerlaufStore({ cipher: fakeCipher(), file, istAktiv: () => true })
    await store.aufzeichnen(eintrag('a'))
    await store.loeschen()
    expect(file.data).toBeNull()
    expect(await store.liste()).toEqual([])
  })

  it('loeschenEintrag entfernt genau einen Eintrag, lässt die übrigen (VL-3)', async () => {
    const file = fakeFile()
    const store = createVerlaufStore({ cipher: fakeCipher(), file, istAktiv: () => true })
    await store.aufzeichnen(eintrag('a'))
    await store.aufzeichnen(eintrag('b'))
    await store.aufzeichnen(eintrag('c'))
    await store.loeschenEintrag('b')
    expect((await store.liste()).map((e) => e.id)).toEqual(['c', 'a'])
  })

  it('loeschenEintrag mit unbekannter Id ist ein No-Op', async () => {
    const file = fakeFile()
    const store = createVerlaufStore({ cipher: fakeCipher(), file, istAktiv: () => true })
    await store.aufzeichnen(eintrag('a'))
    await store.loeschenEintrag('x')
    expect((await store.liste()).map((e) => e.id)).toEqual(['a'])
  })

  it('loeschenEintrag des letzten Eintrags entfernt die Datei', async () => {
    const file = fakeFile()
    const store = createVerlaufStore({ cipher: fakeCipher(), file, istAktiv: () => true })
    await store.aufzeichnen(eintrag('a'))
    await store.loeschenEintrag('a')
    expect(file.data).toBeNull()
  })

  it('bei Entschlüsselungsfehler (anderer Benutzer/Profil) → leere Liste statt Wurf', async () => {
    const file = fakeFile()
    file.data = new TextEncoder().encode('NICHT-ENTSCHLUESSELBAR')
    const store = createVerlaufStore({ cipher: fakeCipher(), file, istAktiv: () => true })
    expect(await store.liste()).toEqual([])
  })

  it('schreibt nicht, wenn Verschlüsselung nicht verfügbar ist', async () => {
    const file = fakeFile()
    const store = createVerlaufStore({ cipher: fakeCipher(false), file, istAktiv: () => true })
    expect(await store.aufzeichnen(eintrag('a'))).toBe(false) // P5b: nicht verschlüsselbar → false
    expect(file.data).toBeNull()
  })
})
