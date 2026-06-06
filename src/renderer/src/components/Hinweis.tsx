import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { cn } from '@/lib/utils'

// App-weite Toasts (P6) — handgerollt nach dem Bestaetigung.tsx-Muster (Context + Overlay, keine Deps).
// Für OPERATIONSERGEBNISSE (gespeichert/gelöscht/zurückgesetzt/Key getestet …), NICHT für laufende
// Validierungs-Zustände (die bleiben inline). Erfolg blendet automatisch aus; Fehler bleibt stehen
// (manuell schließen). Zwei Live-Regionen für Barrierefreiheit: status (höflich) / alert (bestimmt).
// Nutzung: const zeige = useHinweis(); zeige('Gespeichert.', 'erfolg').

export type HinweisTyp = 'erfolg' | 'fehler'

interface Hinweis {
  id: string
  text: string
  typ: HinweisTyp
}

const ERFOLG_MS = 2500

const Ctx = createContext<(text: string, typ?: HinweisTyp) => void>(() => {})

export function useHinweis(): (text: string, typ?: HinweisTyp) => void {
  return useContext(Ctx)
}

export function HinweisProvider({ children }: { children: ReactNode }) {
  const [hinweise, setHinweise] = useState<Hinweis[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const entfernen = useCallback((id: string) => {
    setHinweise((hs) => hs.filter((h) => h.id !== id))
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])

  const zeige = useCallback(
    (text: string, typ: HinweisTyp = 'erfolg') => {
      const id = globalThis.crypto.randomUUID()
      setHinweise((hs) => [...hs, { id, text, typ }])
      // Erfolg blendet automatisch aus; Fehler bleibt (manuell schließen).
      if (typ === 'erfolg') {
        timers.current.set(
          id,
          setTimeout(() => entfernen(id), ERFOLG_MS)
        )
      }
    },
    [entfernen]
  )

  // Beim Unmount alle Timer räumen (StrictMode-sicher, kein Leak).
  useEffect(() => {
    const map = timers.current
    return () => {
      for (const t of map.values()) clearTimeout(t)
      map.clear()
    }
  }, [])

  const erfolge = hinweise.filter((h) => h.typ === 'erfolg')
  const fehler = hinweise.filter((h) => h.typ === 'fehler')

  return (
    <Ctx.Provider value={zeige}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {erfolge.map((h) => (
            <ToastKarte key={h.id} hinweis={h} onClose={() => entfernen(h.id)} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          {fehler.map((h) => (
            <ToastKarte key={h.id} hinweis={h} onClose={() => entfernen(h.id)} />
          ))}
        </div>
      </div>
    </Ctx.Provider>
  )
}

function ToastKarte({ hinweis, onClose }: { hinweis: Hinweis; onClose: () => void }) {
  return (
    <div className="pointer-events-auto flex items-start gap-2 rounded-md border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg">
      <span
        aria-hidden
        className={cn(
          'mt-px shrink-0 font-bold',
          hinweis.typ === 'erfolg' ? 'text-success' : 'text-destructive'
        )}
      >
        {hinweis.typ === 'erfolg' ? '✓' : '!'}
      </span>
      <span className="min-w-0 flex-1">{hinweis.text}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
    </div>
  )
}
