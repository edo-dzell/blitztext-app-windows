#!/usr/bin/env bash
# Cross-kompiliert win-paste.exe auf Linux via mingw-w64 (ADR-0006). Damit baut das gesamte
# v1-Portable-zip auf Linux/WSL; Windows wird nur zum Verifizieren/Ausführen gebraucht.
#
# Aufruf: bash native/win-paste/build.sh [ausgabepfad]   (Standard: resources/win-paste.exe)
set -euo pipefail

CC="${MINGW_CC:-x86_64-w64-mingw32-gcc}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${SCRIPT_DIR}/win-paste.c"
OUT="${1:-resources/win-paste.exe}"

if ! command -v "$CC" >/dev/null 2>&1; then
  echo "FEHLER: '$CC' nicht gefunden." >&2
  echo "  mingw-w64 installieren:  sudo apt-get install -y gcc-mingw-w64-x86-64" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
# -mwindows: GUI-Subsystem, damit beim Start kein Konsolenfenster aufblitzt.
"$CC" -O2 -mwindows "$SRC" -o "$OUT" -luser32
echo "gebaut: $OUT"
command -v file >/dev/null 2>&1 && file "$OUT" || true
