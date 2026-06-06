# Blitztext für Windows

Windows-Port der Speech-to-Text-Tray-App
[`cmagnussen/blitztext-app`](https://github.com/cmagnussen/blitztext-app) (macOS, Swift).

**Hotkey halten → sprechen → transkribieren → optional per LLM umschreiben → in die aktive App einfügen.**
Vier Workflows (Blitztext / Blitztext+ / Blitztext $%&! / Blitztext :)). Cloud-basiert über deinen
eigenen API-Key (OpenAI-kompatible Anbieter); der Schlüssel wird lokal verschlüsselt abgelegt
(Windows DPAPI via Electron `safeStorage`), nie im Klartext.

**Stack:** Electron 33 · React 19 · TypeScript · Vite (electron-vite) · Vitest · Tailwind v4.

## Funktionen

- Globaler Hotkey zum Diktieren, transkribieren über die Cloud
- Optionales Umschreiben per LLM (vier Workflows mit eigenen Prompts, Ton & Emoji-Stufe)
- Mehrere Anbieter konfigurierbar, je ein verschlüsselter Schlüssel pro Anbieter
- Verlauf mit Kosten, Statistik mit Token-Summen und editierbarer Preistabelle
- Hell-/Dunkel-Design nach System oder manuell
- Tray-Integration, fokusfreie Status-Pille beim Diktieren

## Voraussetzungen

- Node.js 22+, npm 10+
- Zielplattform Windows 10/11; Entwicklung auch unter Linux/WSL möglich
- Ein eigener API-Key eines OpenAI-kompatiblen Anbieters (Transkription + Umschreiben)

## Befehle

```bash
npm install          # Abhängigkeiten installieren
npm run dev          # App im Dev-Modus starten (Tray + Fenster, HMR) — nur unter Windows lauffähig
npm test             # Vitest einmalig ausführen
npm run typecheck    # TypeScript prüfen, ohne zu bauen
npm run build        # Produktions-Bundle nach out/
npm run package:win  # portable Windows-ZIP nach release/ bauen (unsigniert);
                     # baut zuvor das win-paste.exe-Helferprogramm (mingw-w64 Cross-Build)
```

> Die GUI ist nur unter Windows lauffähig; in einer Linux/WSL-Sandbox startet die Electron-GUI nicht
> (Chrome-Sandbox). Logik-Verifikation dort über `npm test` / `npm run typecheck` / `npm run build`.
>
> Die Windows-Builds sind **portabel und unsigniert** — beim ersten Start kann Windows SmartScreen
> einen Hinweis zeigen.

## Struktur

```text
src/
  main/      Electron Main-Prozess (Komposition, Sitzung, Runner, Provider, Secrets,
             Verlauf/Statistik, Hotkey, Tray/Fenster, IPC)
  preload/   contextBridge-API zwischen Main und Renderer
  renderer/  React-Dashboard (Übersicht/Workflows/Verlauf/Statistik/Einstellungen/Über)
             + UI-Kit + versteckter Recorder + Status-Pille
  shared/    framework-unabhängige Domänendaten (workflows, providers, pricing)
test/        Vitest-Tests
scripts/     Hilfsskripte (Tray-Icons, Release-Retention)
native/      win-paste.exe-Quelle (mingw-w64 Cross-Build)
```

## Lizenz

MIT — siehe [`LICENSE`](./LICENSE). Dieses Projekt ist ein eigenständiger Windows-Neuschrieb des
macOS-Originals [`cmagnussen/blitztext-app`](https://github.com/cmagnussen/blitztext-app); dessen
Urheberrechtsvermerk ist gemäß MIT-Lizenz im `LICENSE` erhalten.
