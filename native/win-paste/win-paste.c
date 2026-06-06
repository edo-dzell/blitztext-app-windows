/*
 * win-paste.exe — winziger nativer Paste-Helfer (ADR-0003).
 *
 * Die Zwischenablage wird VOR dem Aufruf von der App gesetzt (paste-service.ts). Dieser Helfer
 * sendet nur den Einfüge-Tastendruck ins Paste-Ziel (das Vordergrundfenster):
 *   - Terminal erkannt  → Strg+Shift+V (Konsolen nehmen Strg+V nicht als Einfügen)
 *   - sonst             → Strg+V
 *
 * Zuvor werden physisch gehaltene Modifier freigegeben, damit der gehaltene "Halten"-Hotkey das
 * synthetische Strg+V nicht zu Strg+Alt+V o.ä. kontaminiert (ADR-0003, Bezug ADR-0002).
 *
 * Laufzeit-Feinabstimmung (welche Terminal-Klassen, Modifier-Restore, Timing) ist HITL/Windows
 * (#04) — hier steht die nach ADR-0003 erwartete Struktur; gebaut wird via mingw-w64 cross (ADR-0006).
 *
 * Bekannte Grenze: Läuft das Vordergrundfenster als Administrator, nimmt es von einer
 * nicht-erhöhten App kein SendInput an → die Fallback-Kette (PowerShell/Hinweis) greift.
 */

#include <windows.h>
#include <string.h>

static void send_key(WORD vk, BOOL up) {
    INPUT in;
    ZeroMemory(&in, sizeof(in));
    in.type = INPUT_KEYBOARD;
    in.ki.wVk = vk;
    in.ki.dwFlags = up ? KEYEVENTF_KEYUP : 0;
    SendInput(1, &in, sizeof(INPUT));
}

static BOOL is_down(int vk) {
    return (GetAsyncKeyState(vk) & 0x8000) != 0;
}

static BOOL foreground_is_terminal(void) {
    HWND hwnd = GetForegroundWindow();
    if (!hwnd) return FALSE;
    char cls[256] = {0};
    if (!GetClassNameA(hwnd, cls, (int)sizeof(cls))) return FALSE;
    return strcmp(cls, "ConsoleWindowClass") == 0            /* klassische Konsole (conhost) */
        || strcmp(cls, "CASCADIA_HOSTING_WINDOW_CLASS") == 0 /* Windows Terminal */
        || strcmp(cls, "mintty") == 0;                       /* Git Bash / mintty */
}

int main(void) {
    static const WORD mods[] = {
        VK_LCONTROL, VK_RCONTROL, VK_LMENU, VK_RMENU,
        VK_LSHIFT, VK_RSHIFT, VK_LWIN, VK_RWIN
    };
    const int n = (int)(sizeof(mods) / sizeof(mods[0]));

    BOOL was_down[8];
    for (int i = 0; i < n; i++) {
        was_down[i] = is_down(mods[i]);
        if (was_down[i]) send_key(mods[i], TRUE);
    }
    Sleep(5); /* dem System Zeit geben, die freigegebenen Modifier zu verarbeiten */

    BOOL terminal = foreground_is_terminal();

    send_key(VK_CONTROL, FALSE);
    if (terminal) send_key(VK_SHIFT, FALSE);
    send_key('V', FALSE);
    send_key('V', TRUE);
    if (terminal) send_key(VK_SHIFT, TRUE);
    send_key(VK_CONTROL, TRUE);

    /* Best-effort-Restore zuvor gehaltener Modifier (physisch hält der Nutzer den Hotkey ggf.
       weiter; finale Abstimmung HITL/Windows, #04). */
    for (int i = 0; i < n; i++) {
        if (was_down[i]) send_key(mods[i], FALSE);
    }
    return 0;
}
