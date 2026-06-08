// A9: Entscheidet, ob ein globaler Enter-Tastendruck einen Bestätigungs-Dialog bestätigen darf.
// Destruktive (gefahr) Dialoge bestätigen NICHT per globalem Enter — sonst löscht ein versehentlicher
// Enter (z. B. aus einem Eingabefeld) unabsichtlich. Harmlose Dialoge behalten Enter-zum-Bestätigen.
// Rein/node-testbar; das echte Fokus-/Default-Fokus-Verhalten bleibt Windows-HITL.
export function enterDarfBestaetigen(gefahr: boolean): boolean {
  return !gefahr
}
