import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import { Button } from '@/components/ui/button'

// Themed Bestätigungs-Dialog (statt nativem window.confirm) — für ALLE destruktiven Aktionen, damit
// nichts versehentlich gelöscht wird. Nutzung: const bestaetige = useBestaetigung(); if (await
// bestaetige({ titel, text, bestaetigen, gefahr })) { … }

export interface BestaetigungsOptionen {
  titel: string
  text?: string
  /** Beschriftung des Bestätigen-Buttons (Default „OK"). */
  bestaetigen?: string
  /** true = roter (destruktiver) Bestätigen-Button. */
  gefahr?: boolean
}

const Ctx = createContext<(o: BestaetigungsOptionen) => Promise<boolean>>(async () => false)

export function useBestaetigung(): (o: BestaetigungsOptionen) => Promise<boolean> {
  return useContext(Ctx)
}

export function BestaetigungsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    o: BestaetigungsOptionen
    resolve: (b: boolean) => void
  } | null>(null)

  const bestaetige = useCallback(
    (o: BestaetigungsOptionen) =>
      new Promise<boolean>((resolve) => setState({ o, resolve })),
    []
  )

  const schliesse = useCallback(
    (b: boolean) => {
      state?.resolve(b)
      setState(null)
    },
    [state]
  )

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') schliesse(false)
      if (e.key === 'Enter') schliesse(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state, schliesse])

  return (
    <Ctx.Provider value={bestaetige}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={() => schliesse(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-lg border bg-card p-5 text-card-foreground shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">{state.o.titel}</p>
            {state.o.text && <p className="mt-1 text-sm text-muted-foreground">{state.o.text}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => schliesse(false)}>
                Abbrechen
              </Button>
              <Button
                variant={state.o.gefahr ? 'destructive' : 'default'}
                size="sm"
                onClick={() => schliesse(true)}
              >
                {state.o.bestaetigen ?? 'OK'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
