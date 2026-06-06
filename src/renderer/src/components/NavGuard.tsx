import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'
import { useBestaetigung } from '@/components/Bestaetigung'
import { mussFragen } from '@/lib/nav-guard-core'

// Globaler Navigations-Wächter (P8): Views melden ihren Dirty-Zustand an; jede Navigationsaktion
// läuft durch versucheNavigation(). Hat mindestens eine Quelle ungespeicherte Änderungen, kommt ein
// 2-Knopf-Dialog (Verwerfen/Abbrechen) via useBestaetigung — daher MUSS dieser Provider INNERHALB des
// BestaetigungsProvider liegen (sonst stiller Default-Stub = Datenverlust). Die Entscheidungslogik
// (mussFragen) ist in lib/nav-guard-core node-getestet.

interface NavGuardApi {
  /** Eine Dirty-Quelle registrieren; gibt eine Abmelde-Funktion zurück (useEffect-Cleanup). */
  registriereDirty: (quelleId: string, istDirty: () => boolean) => () => void
  /** Eine Navigation versuchen; fragt nur bei ungespeicherten Änderungen nach. */
  versucheNavigation: (aktion: () => void) => Promise<void>
}

const Ctx = createContext<NavGuardApi>({
  registriereDirty: () => () => {},
  versucheNavigation: async (aktion) => aktion()
})

export function useNavGuard(): NavGuardApi {
  return useContext(Ctx)
}

export function NavGuardProvider({ children }: { children: ReactNode }) {
  const bestaetige = useBestaetigung()
  const quellen = useRef<Map<string, () => boolean>>(new Map())

  const registriereDirty = useCallback((quelleId: string, istDirty: () => boolean) => {
    quellen.current.set(quelleId, istDirty)
    return () => {
      quellen.current.delete(quelleId)
    }
  }, [])

  const versucheNavigation = useCallback(
    async (aktion: () => void) => {
      const flags = [...quellen.current.values()].map((f) => f())
      if (!mussFragen(flags)) {
        aktion()
        return
      }
      const ok = await bestaetige({
        titel: 'Ungespeicherte Änderungen verwerfen?',
        text: 'Es gibt ungespeicherte Änderungen. Beim Wechsel gehen sie verloren.',
        bestaetigen: 'Verwerfen',
        gefahr: true
      })
      if (ok) aktion()
    },
    [bestaetige]
  )

  return <Ctx.Provider value={{ registriereDirty, versucheNavigation }}>{children}</Ctx.Provider>
}
