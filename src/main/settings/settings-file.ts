import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { SettingsFile } from './store'

// Einstellungs-Datei im benutzergebundenen userData-Verzeichnis — pro Benutzer (ADR-0005/ADR-0006:
// portabel = Daten in %APPDATA%, wandern nicht mit). Pfad injizierbar → ohne Electron testbar.
// Muster wie ciphertext-file.ts (#01).
export function createSettingsFile(
  filePath: string = join(app.getPath('userData'), 'settings.json')
): SettingsFile {
  return {
    async read() {
      try {
        return await readFile(filePath, 'utf-8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },
    async write(content) {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, content, 'utf-8')
    }
  }
}
