// Renderer der Status-Pille (ADR-0007/0009): zeigt nur das vom Main-Prozess gesendete Phasen-Label.
// Kein UI-Zustand, kein Design-System (v1, bewusst minimal). Sichtbarkeit/Position steuert der Main.

declare global {
  interface Window {
    blitztextPill: {
      onStatus(cb: (label: string) => void): void
    }
  }
}

const el = document.getElementById('pille')
window.blitztextPill.onStatus((label) => {
  if (el) el.textContent = label
})

export {}
