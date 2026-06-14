// Behält nur die ZWEI neuesten Release-Artefakte in release/ (aktuelle Live-Version + Vorgänger) und
// löscht ältere, damit der Speicher nicht vollläuft. Läuft am Ende von `npm run package:win`.
// Erfasst portable .exe (Standard-Target seit 2026-06-14) UND .zip (Alt-Artefakte) — so räumt es auch
// nach einem Target-Wechsel sauber auf. Bewusst ohne Abhängigkeiten (Node-Built-ins) → läuft überall.

import { readdirSync, statSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RELEASE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'release')
const BEHALTEN = 2 // aktuelle + vorherige Version
const istArtefakt = (name) => name.endsWith('.exe') || name.endsWith('.zip')

function main() {
  let dateien
  try {
    dateien = readdirSync(RELEASE_DIR)
  } catch {
    return // kein release/-Verzeichnis (z. B. Build ohne Paketierung) → nichts zu tun
  }

  const artefakte = dateien
    .filter(istArtefakt)
    .map((name) => {
      const pfad = join(RELEASE_DIR, name)
      return { name, pfad, mtime: statSync(pfad).mtimeMs }
    })
    // neueste zuerst
    .sort((a, b) => b.mtime - a.mtime)

  const zuLoeschen = artefakte.slice(BEHALTEN)
  for (const z of zuLoeschen) {
    rmSync(z.pfad, { force: true })
    console.log(`retain-releases: altes Artefakt gelöscht → ${z.name}`)
  }
  const behalten = artefakte.slice(0, BEHALTEN).map((z) => z.name)
  console.log(
    `retain-releases: ${behalten.length} Artefakt(e) behalten${behalten.length ? ' → ' + behalten.join(', ') : ''}`
  )
}

main()
