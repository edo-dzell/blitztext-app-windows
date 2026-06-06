import { createApiKeyStore, type ApiKeyStore } from './api-key-store'
import { safeStorageCipher } from './safe-storage-cipher'
import { createApiKeyFile } from './ciphertext-file'

export type { ApiKeyStore } from './api-key-store'
export { validateApiKey, type ApiKeyValidation } from './validate-api-key'

// Im Main-Prozess verdrahteter Store mit den echten Adaptern (safeStorage + Datei).
export function createDefaultApiKeyStore(): ApiKeyStore {
  return createApiKeyStore({ cipher: safeStorageCipher, file: createApiKeyFile() })
}
