import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    base: './', // relative Asset-URLs für file://-Laden des gepackten Builds (Tailwind-CSS etc.)
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        // @main NUR für REINE, framework-unabhängige Logik (z. B. prompt-builder, R2/#10). Niemals
        // ein Main-Modul mit Electron/Node-Abhängigkeit aus dem Renderer importieren.
        '@main': resolve('src/main'),
        '@': resolve('src/renderer/src') // für shadcn-Stil-Importe "@/components", "@/lib/utils"
      }
    },
    build: {
      rollupOptions: {
        // Zwei Renderer-Eintragspunkte: das Einstellungs-/Onboarding-Fenster (index.html) und der
        // versteckte Aufnahme-Renderer (recorder.html, #03/#11).
        input: {
          index: resolve('src/renderer/index.html'),
          recorder: resolve('src/renderer/recorder.html'),
          pill: resolve('src/renderer/pill.html')
        }
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
