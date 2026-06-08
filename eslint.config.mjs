// Minimale, architektur-fokussierte Lint-Regel (A10.2): verbietet WERT-Importe von Main-Prozess-Modulen
// (@main) im Renderer — Typ-Importe (`import type`) sind ok. Hält den Renderer-Bundle frei von Electron/
// Node-Code. Bewusst KEIN allgemeines Regelwerk (kein Floodgate auf nie-gelintetem Bestand); der
// typecheck deckt den Rest. Reine @main-Logik (prompt-builder, electron.vite.config erlaubt sie für R2/#10)
// nur per gezielter eslint-disable-Ausnahme an der Importzeile.

import tseslint from 'typescript-eslint'

export default tseslint.config({
  files: ['src/renderer/**/*.{ts,tsx}'],
  plugins: { '@typescript-eslint': tseslint.plugin },
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } }
  },
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@main', '@main/*'],
            allowTypeImports: true,
            message:
              'Renderer darf keinen Main-/Electron-Code als WERT importieren (nur @shared-Logik; Typen sind ok).'
          }
        ]
      }
    ]
  }
})
