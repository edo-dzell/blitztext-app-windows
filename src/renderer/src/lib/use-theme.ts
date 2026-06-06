import { useEffect } from 'react'
import type { BlitztextSettings } from '@main/settings/store'

// Wendet das gewählte Farbschema auf <html> an: .dark-Klasse + color-scheme (für native Controls,
// Popups, Scrollbars). 'system' folgt nativeTheme aus dem Main (IPC); 'hell'/'dunkel' sind fix.
export function useTheme(theme: BlitztextSettings['theme'] | undefined): void {
  useEffect(() => {
    if (!theme) return
    const wende = (dark: boolean): void => {
      const root = document.documentElement
      root.classList.toggle('dark', dark)
      root.style.colorScheme = dark ? 'dark' : 'light'
    }
    if (theme === 'dunkel') return wende(true)
    if (theme === 'hell') return wende(false)
    // 'system': Initialwert holen + auf Änderungen lauschen.
    void window.blitztext.theme.systemDark().then(wende)
    window.blitztext.theme.onSystemChanged(wende)
  }, [theme])
}
