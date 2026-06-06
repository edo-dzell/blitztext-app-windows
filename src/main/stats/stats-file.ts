import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { StatsFile } from './stats-store'

// Statistik-Datei (text-frei, unverschlüsselt) im userData-Verzeichnis — pro Benutzer (ADR-0005).
// Muster wie settings-file.ts. Pfad injizierbar → ohne Electron testbar.
export function createStatsFile(
  filePath: string = join(app.getPath('userData'), 'stats.json')
): StatsFile {
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
