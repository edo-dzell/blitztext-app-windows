import { describe, it, expect } from 'vitest'
import { createApiKeyStore, type SecretCipher, type CiphertextFile } from '@main/secrets/api-key-store'

// Reversibler Fake-Cipher: macht aus Klartext erkennbares "Chiffrat" (Präfix + umgedreht),
// damit Tests sowohl den Round-Trip als auch "es wird verschlüsselt geschrieben" prüfen können.
function fakeCipher(available = true): SecretCipher {
  const TAG = 'CIPHER::'
  return {
    isEncryptionAvailable: () => available,
    async encrypt(plain) {
      return new TextEncoder().encode(TAG + [...plain].reverse().join(''))
    },
    async decrypt(data) {
      const decoded = new TextDecoder().decode(data)
      if (!decoded.startsWith(TAG)) throw new Error('Kein gültiges Chiffrat')
      return [...decoded.slice(TAG.length)].reverse().join('')
    }
  }
}

function fakeFile(): CiphertextFile & { peek: () => Uint8Array | null } {
  let data: Uint8Array | null = null
  return {
    read: async () => data,
    write: async (d) => {
      data = d
    },
    remove: async () => {
      data = null
    },
    peek: () => data
  }
}

describe('ApiKeyStore', () => {
  it('legt einen Key ab und gibt ihn unverändert wieder zurück', async () => {
    const store = createApiKeyStore({ cipher: fakeCipher(), file: fakeFile() })

    await store.set('sk-test-12345')

    expect(await store.get()).toBe('sk-test-12345')
  })

  it('gibt null zurück, wenn kein Key gespeichert ist', async () => {
    const store = createApiKeyStore({ cipher: fakeCipher(), file: fakeFile() })

    expect(await store.get()).toBeNull()
  })

  it('has() ist false vor dem Speichern und true danach', async () => {
    const store = createApiKeyStore({ cipher: fakeCipher(), file: fakeFile() })

    expect(await store.has()).toBe(false)
    await store.set('sk-abc')
    expect(await store.has()).toBe(true)
  })

  it('clear() entfernt den gespeicherten Key', async () => {
    const store = createApiKeyStore({ cipher: fakeCipher(), file: fakeFile() })

    await store.set('sk-xyz')
    await store.clear()

    expect(await store.has()).toBe(false)
    expect(await store.get()).toBeNull()
  })

  it('schreibt Chiffrat, nicht den Klartext-Key', async () => {
    const file = fakeFile()
    const store = createApiKeyStore({ cipher: fakeCipher(), file })

    await store.set('sk-plaintext')

    const stored = new TextDecoder().decode(file.peek()!)
    expect(stored).not.toContain('sk-plaintext')
  })

  it('wirft beim Speichern, wenn Verschlüsselung nicht verfügbar ist', async () => {
    const store = createApiKeyStore({ cipher: fakeCipher(false), file: fakeFile() })

    await expect(store.set('sk-x')).rejects.toThrow(/Verschlüsselung/)
  })
})
