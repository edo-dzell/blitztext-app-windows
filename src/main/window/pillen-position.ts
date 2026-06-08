// Position der Status-Pille (A8): horizontal zentriert, am unteren Rand der Arbeitsfläche (mit etwas
// Luft) — dann HART in die sichtbaren Bounds geklemmt. So liegt die Pille auch nach einem Display-Wechsel
// / Standby nie außerhalb des sichtbaren Bereichs („Pille einmal nicht angezeigt"-Bug). Rein/testbar;
// die eigentliche Anzeige + das Reanchoring an screen-Events bleiben HITL/Windows (A8.2).

export interface Bereich {
  x: number
  y: number
  width: number
  height: number
}

export interface Groesse {
  width: number
  height: number
}

export function pillenPosition(
  area: Bereich,
  pille: Groesse,
  randUnten = 12
): { x: number; y: number } {
  const wunschX = area.x + Math.round((area.width - pille.width) / 2)
  const wunschY = area.y + area.height - pille.height - randUnten
  const maxX = area.x + Math.max(0, area.width - pille.width)
  const maxY = area.y + Math.max(0, area.height - pille.height)
  return {
    x: Math.min(Math.max(wunschX, area.x), maxX),
    y: Math.min(Math.max(wunschY, area.y), maxY)
  }
}
