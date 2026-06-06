// Sichere Ablage des OpenAI-API-Keys (ADR-0004). Der Kern ist framework-frei und hängt nur an
// injizierten Ports (Cipher, Datei), damit er ohne echtes safeStorage/Dateisystem testbar ist.
// Die echten Adapter (Electron safeStorage, fs) werden im Main-Prozess verdrahtet.

export interface SecretCipher {
  isEncryptionAvailable(): boolean
  encrypt(plain: string): Promise<Uint8Array>
  decrypt(data: Uint8Array): Promise<string>
}

export interface CiphertextFile {
  read(): Promise<Uint8Array | null>
  write(data: Uint8Array): Promise<void>
  remove(): Promise<void>
}

export interface ApiKeyStore {
  has(): Promise<boolean>
  get(): Promise<string | null>
  set(key: string): Promise<void>
  clear(): Promise<void>
}

export function createApiKeyStore({
  cipher,
  file
}: {
  cipher: SecretCipher
  file: CiphertextFile
}): ApiKeyStore {
  return {
    async set(key) {
      if (!cipher.isEncryptionAvailable()) {
        throw new Error('Verschlüsselung nicht verfügbar')
      }
      const data = await cipher.encrypt(key)
      await file.write(data)
    },
    async get() {
      const data = await file.read()
      if (data === null) return null
      return cipher.decrypt(data)
    },
    async has() {
      return (await file.read()) !== null
    },
    async clear() {
      await file.remove()
    }
  }
}
