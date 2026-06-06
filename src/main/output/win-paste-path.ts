// Pfadauflösung des nativen Paste-Helfers (win-paste.exe), ADR-0006: ein stabiler Codepfad für v1
// (portables zip) und v2 (Installer). Verpackt liegt der Helfer als extraResource unter
// process.resourcesPath; im Dev-Modus unter <appPfad>/resources. Reine Funktion → ohne Electron
// testbar; der Adapter (HITL/Windows, #04/#11) reicht die echten Werte aus `app`/`process` hinein.

import { join } from 'node:path'

export interface HelferPfadUmgebung {
  /** app.isPackaged */
  istVerpackt: boolean
  /** process.resourcesPath — nur im verpackten Zustand relevant */
  resourcesPath: string
  /** app.getAppPath() — Anker im Dev-Modus */
  appPfad: string
}

export function winPastePfad(umgebung: HelferPfadUmgebung): string {
  return umgebung.istVerpackt
    ? join(umgebung.resourcesPath, 'win-paste.exe')
    : join(umgebung.appPfad, 'resources', 'win-paste.exe')
}
