import { app } from 'electron'
import { readFile, writeFile, rm, mkdir, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CiphertextFile } from './api-key-store'

// Atomares Ersetzen unter Windows ist nicht trivial (RESEARCH R2): `rename` über ein existierendes
// Ziel kann EEXIST werfen, und Virenscanner sperren die neue Datei kurz (EPERM/EBUSY). Daher: in eine
// temporäre Datei schreiben und mit Retry umbenennen — so wird die Zieldatei nie halb geschrieben.
async function ersetzeAtomar(von: string, nach: string, versuche = 6): Promise<void> {
  for (let i = 0; i < versuche; i++) {
    try {
      await rename(von, nach)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EEXIST') {
        await rm(nach, { force: true }) // Windows: Ziel zuerst entfernen, dann umbenennen
        continue
      }
      if ((code === 'EPERM' || code === 'EBUSY') && i < versuche - 1) {
        await new Promise((r) => setTimeout(r, 25 * (i + 1))) // AV-Lock kurz abwarten
        continue
      }
      throw error
    }
  }
}

// Generische Chiffrat-Datei im benutzergebundenen userData-Verzeichnis — pro Benutzer (ADR-0005).
// Pfad injizierbar → ohne Electron testbar. Genutzt für api-key-<id>.bin und (V2) history.bin.
export function createCiphertextFile(filePath: string): CiphertextFile {
  return {
    async read() {
      try {
        return new Uint8Array(await readFile(filePath))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },
    async write(data) {
      await mkdir(dirname(filePath), { recursive: true })
      const tmp = `${filePath}.tmp`
      await writeFile(tmp, data)
      await ersetzeAtomar(tmp, filePath)
    },
    async remove() {
      await rm(filePath, { force: true })
    }
  }
}

/** Chiffrat-Datei je Anbieter (v0.2.3, ADR-0010): `api-key-<anbieterId>.bin`. */
export function createApiKeyVaultFile(anbieterId: string): CiphertextFile {
  const sicher = anbieterId.replace(/[^a-zA-Z0-9._-]/g, '_')
  return createCiphertextFile(join(app.getPath('userData'), `api-key-${sicher}.bin`))
}

// Chiffrat-Datei des API-Keys (Default-Pfad).
export function createApiKeyFile(
  filePath: string = join(app.getPath('userData'), 'api-key.bin')
): CiphertextFile {
  return createCiphertextFile(filePath)
}

// Verschlüsselte Verlauf-Datei (V2 Strang D).
export function createHistoryFile(
  filePath: string = join(app.getPath('userData'), 'history.bin')
): CiphertextFile {
  return createCiphertextFile(filePath)
}
