import { safeStorage } from 'electron'
import type { SecretCipher } from './api-key-store'

// Adapter auf Electrons safeStorage (auf Windows DPAPI, ADR-0004). Electron 33 stellt nur die
// synchrone API bereit; wir kapseln sie hinter dem async SecretCipher-Port (der DPAPI-Aufruf ist
// lokal/schnell). Bei Electron >= 35 ließe sich auf encryptStringAsync/decryptStringAsync umstellen.
export const safeStorageCipher: SecretCipher = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  async encrypt(plain) {
    return new Uint8Array(safeStorage.encryptString(plain))
  },
  async decrypt(data) {
    return safeStorage.decryptString(Buffer.from(data))
  }
}
