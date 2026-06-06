// Best-Effort-Hotkey-Validator (ADR-0007). Da uiohook Tasten nicht schluckt (RESEARCH §6), können wir
// NICHT wissen, ob eine Kombi in fremden Apps frei ist — wir prüfen nur deterministische Klassen und
// beschriften ehrlich „keine BEKANNTEN Konflikte" (nie „frei"). Reine Logik → unit-testbar; die
// Settings-UI (Tastendruck einfangen, Dialog, Umbelegung) ist HITL (#07).

import type { WorkflowId } from '@shared/workflows'

export type KonfliktArt = 'intern' | 'os-reserviert' | 'altgr' | 'tippt-zeichen' | 'app-shortcut'

export interface ChordKonflikt {
  art: KonfliktArt
  schwere: 'hart' | 'weich'
  meldung: string
  /** nur bei art === 'intern' */
  workflow?: WorkflowId
}

export interface ValidateKontext {
  /** Belegung der übrigen Workflows (das Ziel selbst wird ignoriert). */
  belegung: Partial<Record<WorkflowId, string[]>>
  /** Workflow, dem der Chord zugewiesen werden soll. */
  ziel: WorkflowId
}

export interface ChordUrteil {
  hart: ChordKonflikt[]
  weich: ChordKonflikt[]
  /** true, wenn irgendein Konflikt (hart oder weich) vorliegt. */
  bekannteKonflikte: boolean
}

const istCtrl = (k: string): boolean => k === 'ControlLeft' || k === 'ControlRight'
const istShift = (k: string): boolean => k === 'ShiftLeft' || k === 'ShiftRight'
const istAlt = (k: string): boolean => k === 'AltLeft' || k === 'AltRight'
const istMeta = (k: string): boolean => k === 'MetaLeft' || k === 'MetaRight'
const istModifier = (k: string): boolean => istCtrl(k) || istShift(k) || istAlt(k) || istMeta(k)
const istNichtShiftModifier = (k: string): boolean => istCtrl(k) || istAlt(k) || istMeta(k)
const istDruckbar = (k: string): boolean => /^(Key[A-Z]|Digit[0-9]|Space)$/.test(k)

/** Seiten-agnostische Normalisierung für externe Vergleiche (Apps unterscheiden L/R nicht). */
function normalisiere(chord: string[]): Set<string> {
  return new Set(
    chord.map((k) =>
      istCtrl(k) ? 'Ctrl' : istShift(k) ? 'Shift' : istAlt(k) ? 'Alt' : istMeta(k) ? 'Meta' : k
    )
  )
}

function gleich(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x))
}
function teilmenge(a: Set<string>, b: Set<string>): boolean {
  return [...a].every((x) => b.has(x))
}

// System-Kombis (seiten-agnostisch), die nie belegbar sind.
const SYSTEM_KOMBIS: ReadonlyArray<Set<string>> = [
  new Set(['Ctrl', 'Alt', 'Delete']),
  new Set(['Ctrl', 'Shift', 'Escape']),
  new Set(['Ctrl', 'Escape']),
  new Set(['Alt', 'Tab']),
  new Set(['Alt', 'F4']),
  new Set(['Alt', 'Escape']),
  new Set(['Alt', 'Space'])
]

// Berühmte App-Shortcuts (Ctrl+<Taste>), die in vielen Apps eine sichtbare Aktion auslösen.
const BERUEHMTE_TASTEN = new Set([
  'KeyC', 'KeyV', 'KeyX', 'KeyZ', 'KeyY', 'KeyA', 'KeyS', 'KeyF', 'KeyP',
  'KeyW', 'KeyT', 'KeyN', 'KeyO', 'KeyK', 'KeyL', 'KeyB', 'KeyI', 'KeyU'
])

export function validateChord(chord: string[], kontext: ValidateKontext): ChordUrteil {
  const hart: ChordKonflikt[] = []
  const weich: ChordKonflikt[] = []
  const set = new Set(chord)
  const norm = normalisiere(chord)
  const hatNichtShiftModifier = chord.some(istNichtShiftModifier)
  const hatDruckbar = chord.some(istDruckbar)
  const hatMeta = chord.some(istMeta)
  const hatNichtModifier = chord.some((k) => !istModifier(k))

  // 1) Intern (hart): Gleichheit oder Teilmengen-Beziehung mit einem anderen Workflow (Dispatcher-Regel).
  for (const [wf, binding] of Object.entries(kontext.belegung)) {
    if (wf === kontext.ziel || !binding || binding.length === 0) continue
    const other = new Set(binding)
    if (gleich(set, other) || teilmenge(set, other) || teilmenge(other, set)) {
      hart.push({
        art: 'intern',
        schwere: 'hart',
        workflow: wf as WorkflowId,
        meldung: `Überschneidet sich mit dem Workflow „${wf}". Dort entfernen und hier verwenden?`
      })
    }
  }

  // 2) AltGr (hart): Ctrl+Alt = AltGr auf DE; RechtsAlt ist AltGr (RESEARCH §3).
  if ((chord.some(istCtrl) && chord.some(istAlt)) || chord.includes('AltRight')) {
    hart.push({
      art: 'altgr',
      schwere: 'hart',
      meldung: 'AltGr-Kollision: tippt auf DE-Layout Zeichen wie € @ { } [ ] \\ ~ |.'
    })
  }

  // 3) Tippt ein Zeichen (hart): druckbare Taste ohne Nicht-Shift-Modifier.
  if (hatDruckbar && !hatNichtShiftModifier) {
    hart.push({
      art: 'tippt-zeichen',
      schwere: 'hart',
      meldung: 'Diese Taste(n) tippen normalen Text — als globaler Hotkey ungeeignet.'
    })
  }

  // 4) OS-reserviert (hart): Win + echte Taste, oder eine System-Kombi.
  if (hatMeta && hatNichtModifier) {
    hart.push({
      art: 'os-reserviert',
      schwere: 'hart',
      meldung: 'Windows-Tastenkürzel (Win + Taste) — vom Betriebssystem belegt.'
    })
  } else if (SYSTEM_KOMBIS.some((k) => gleich(norm, k))) {
    hart.push({
      art: 'os-reserviert',
      schwere: 'hart',
      meldung: 'Vom Betriebssystem reservierte Tastenkombination.'
    })
  } else if (hatMeta) {
    // 5) Win nur mit Modifiern (z. B. Strg+Win): weiche Startmenü-Warnung (nicht unterdrückbar).
    weich.push({
      art: 'os-reserviert',
      schwere: 'weich',
      meldung: 'Win-Kombi: das Loslassen der Win-Taste kann das Startmenü öffnen.'
    })
  }

  // 6) Berühmte App-Shortcuts (weich): Ctrl + eine bekannte Taste (seiten-agnostisch, genau 2 Tasten).
  if (norm.size === 2 && norm.has('Ctrl')) {
    const taste = [...norm].find((k) => k !== 'Ctrl')
    if (taste && BERUEHMTE_TASTEN.has(taste)) {
      weich.push({
        art: 'app-shortcut',
        schwere: 'weich',
        meldung: `Strg+${taste.replace('Key', '')} ist in vielen Apps belegt (z. B. Kopieren/Einfügen/Link).`
      })
    }
  }

  return { hart, weich, bekannteKonflikte: hart.length > 0 || weich.length > 0 }
}
