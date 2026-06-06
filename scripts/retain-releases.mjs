// Behält nur die ZWEI neuesten Release-ZIPs in release/ (aktuelle Live-Version + Vorgänger) und
// löscht ältere, damit der Speicher nicht vollläuft. Läuft am Ende von `npm run package:win`.
// Bewusst eigenständig + ohne Abhängigkeiten (Node-Built-ins), damit es überall läuft.

import { readdirSync, statSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RELEASE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'release')
const BEHALTEN = 2 // aktuelle + vorherige Version

function main() {
  let dateien
  try {
    dateien = readdirSync(RELEASE_DIR)
  } catch {
    return // kein release/-Verzeichnis (z. B. Build ohne Paketierung) → nichts zu tun
  }

  const zips = dateien
    .filter((name) => name.endsWith('.zip'))
    .map((name) => {
      const pfad = join(RELEASE_DIR, name)
      return { name, pfad, mtime: statSync(pfad).mtimeMs }
    })
    // neueste zuerst
    .sort((a, b) => b.mtime - a.mtime)

  const zuLoeschen = zips.slice(BEHALTEN)
  for (const z of zuLoeschen) {
    rmSync(z.pfad, { force: true })
    console.log(`retain-releases: alte ZIP gelöscht → ${z.name}`)
  }
  const behalten = zips.slice(0, BEHALTEN).map((z) => z.name)
  console.log(
    `retain-releases: ${behalten.length} ZIP(s) behalten${behalten.length ? ' → ' + behalten.join(', ') : ''}`
  )
}

main()
