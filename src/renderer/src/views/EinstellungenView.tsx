import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { BlitztextSettings } from '@main/settings/store'
import type { AnbieterKonfig } from '@shared/anbieter'
import { PROVIDER, getProvider, modelleFuerVorlage } from '@shared/providers'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Field, Separator } from '@/components/ui/field'
import ZweiEbenenShell from '@/components/ZweiEbenenShell'
import { useBestaetigung } from '@/components/Bestaetigung'
import { useHinweis } from '@/components/Hinweis'
import { useNavGuard } from '@/components/NavGuard'
import { einstellungenGeaendert } from '@/lib/dirty'

// Einstellungen (P8): Zwei-Ebenen-Ansicht. Band = Anbieter (vorausgewählt) / Transkription & Umschreiben
// / Datenschutz / Darstellung. Speicher-Modell A: EIN globaler Entwurf, EIN fest sichtbarer (dirty-
// aware) Speichern-Button im Band-Kopf. Erfolg/Fehler über Toast (App.speichern). API-Keys werden je
// Anbieter weiterhin sofort/separat gespeichert. apiKeyStatus ist Main-only → NICHT Teil des Entwurfs.

interface Props {
  settings: BlitztextSettings
  speichern: (next: BlitztextSettings) => Promise<void>
}

type Abschnitt = 'anbieter' | 'transkription' | 'datenschutz' | 'darstellung'

export default function EinstellungenView({ settings, speichern }: Props) {
  const [entwurf, setEntwurf] = useState<BlitztextSettings>(settings)
  const [busy, setBusy] = useState(false)
  const [vorlage, setVorlage] = useState('openai')
  const [auswahl, setAuswahl] = useState<Abschnitt>('anbieter')
  const bestaetige = useBestaetigung()
  const { registriereDirty } = useNavGuard()

  // P8: ein überlebender Entwurf; dirty-aware (apiKeyStatus ausgenommen). Beim Sidebar-Verlassen
  // schützt der globale Guard; Band-interne Wechsel sind sicher (Entwurf bleibt erhalten).
  const geaendert = einstellungenGeaendert(entwurf, settings)
  useEffect(() => registriereDirty('settings', () => geaendert), [registriereDirty, geaendert])

  function setAnbieter(id: string, patch: Partial<AnbieterKonfig>) {
    setEntwurf((e) => ({
      ...e,
      anbieter: e.anbieter.map((a) => (a.id === id ? { ...a, ...patch } : a))
    }))
  }

  function fuegeAnbieterHinzu() {
    const d = getProvider(vorlage)
    if (!d) return
    const neu: AnbieterKonfig = {
      id: globalThis.crypto.randomUUID(),
      vorlage: d.id,
      label: d.label,
      baseUrl: d.baseUrl,
      asrModell: d.asrModelle.find((m) => m.empfohlen)?.id ?? d.asrModelle[0]?.id ?? '',
      chatModell: d.chatModelle.find((m) => m.empfohlen)?.id ?? d.chatModelle[0]?.id ?? ''
    }
    setEntwurf((e) => ({ ...e, anbieter: [...e.anbieter, neu] }))
  }

  async function entferneAnbieter(id: string) {
    const a = entwurf.anbieter.find((x) => x.id === id)
    const ok = await bestaetige({
      titel: 'Anbieter entfernen?',
      text: `„${a?.label ?? ''}" und sein gespeicherter API-Key werden entfernt.`,
      bestaetigen: 'Entfernen',
      gefahr: true
    })
    if (!ok) return
    await window.blitztext.apiKey.clear(id) // Key dieses Anbieters räumen (Vault + apiKeyStatus, Main)
    setEntwurf((e) => {
      const rest = e.anbieter.filter((a) => a.id !== id)
      const standard = e.standardAnbieterId === id ? (rest[0]?.id ?? '') : e.standardAnbieterId
      return { ...e, anbieter: rest, standardAnbieterId: standard }
    })
  }

  async function speichereAlles() {
    setBusy(true)
    await speichern(entwurf) // Erfolg/Fehler-Toast über den gemeinsamen App.speichern-Pfad
    setBusy(false)
  }

  const eintraege = [
    { id: 'anbieter', titel: 'Anbieter' },
    { id: 'transkription', titel: 'Transkription & Umschreiben' },
    { id: 'datenschutz', titel: 'Datenschutz' },
    { id: 'darstellung', titel: 'Darstellung' }
  ]

  return (
    <ZweiEbenenShell
      eintraege={eintraege}
      aktivId={auswahl}
      onWaehle={(id) => setAuswahl(id as Abschnitt)}
      bandKopf={
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={speichereAlles} disabled={busy || !geaendert}>
            {busy ? 'Speichere…' : 'Einstellungen speichern'}
          </Button>
          <p className="text-[11px] leading-tight text-muted-foreground">
            API-Keys werden je Anbieter sofort gespeichert (separat von „Speichern").
          </p>
        </div>
      }
    >
      {auswahl === 'anbieter' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            OpenAI-kompatible Anbieter für Transkription und Umschreiben. Pro Workflow lässt sich ein
            Anbieter zuordnen; ohne Zuordnung gilt der Standard.
          </p>
          {entwurf.anbieter.map((a) => (
            <AnbieterKarte
              key={a.id}
              anbieter={a}
              istStandard={a.id === entwurf.standardAnbieterId}
              standardWaehlen={() => setEntwurf((e) => ({ ...e, standardAnbieterId: a.id }))}
              aendere={(patch) => setAnbieter(a.id, patch)}
              entferne={entwurf.anbieter.length > 1 ? () => entferneAnbieter(a.id) : undefined}
            />
          ))}
          <div className="flex items-center gap-2">
            <Select value={vorlage} onChange={(e) => setVorlage(e.target.value)}>
              {PROVIDER.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" onClick={fuegeAnbieterHinzu}>
              <Plus /> Hinzufügen
            </Button>
          </div>
        </div>
      )}

      {auswahl === 'transkription' && (
        <div className="flex flex-col gap-4">
          <Field
            label="Sprache"
            hint="Sprache, in der du diktierst — verbessert die Transkription (ISO-Code, z. B. de, en). Pro Workflow überschreibbar."
          >
            <Input
              value={entwurf.language}
              onChange={(e) => setEntwurf({ ...entwurf, language: e.target.value })}
            />
          </Field>
          <Field
            label="Eigene Begriffe"
            hint="Eigennamen/Fachbegriffe, durch Komma getrennt — verbessert Transkription und Umschreiben."
          >
            <Input
              value={entwurf.customTerms.join(', ')}
              placeholder="z. B. Produktname, Eigenname, Fachbegriff"
              onChange={(e) =>
                setEntwurf({
                  ...entwurf,
                  customTerms: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t !== '')
                })
              }
            />
          </Field>
          <Field
            label="Aufnahmemodus"
            hint="Halten: Hotkey gedrückt halten = aufnehmen, loslassen = stopp (Push-to-Talk). Drücken: einmal drücken startet, nochmal oder Escape stoppt."
          >
            <Select
              value={entwurf.aufnahmemodus}
              onChange={(e) =>
                setEntwurf({
                  ...entwurf,
                  aufnahmemodus: e.target.value as BlitztextSettings['aufnahmemodus']
                })
              }
            >
              <option value="hold">Halten</option>
              <option value="toggle">Drücken</option>
            </Select>
          </Field>
        </div>
      )}

      {auswahl === 'datenschutz' && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium">Verlauf-Sperre</p>
              <p className="text-xs text-muted-foreground">
                Erzwingt den Verlauf AUS, egal was unter „Verlauf" eingestellt ist. Audio und Text werden
                weiterhin an den Anbieter gesendet.
              </p>
            </div>
            <Switch
              checked={entwurf.verlaufGesperrt}
              onCheckedChange={(v) => setEntwurf({ ...entwurf, verlaufGesperrt: v })}
            />
          </CardContent>
        </Card>
      )}

      {auswahl === 'darstellung' && (
        <Field label="Farbschema" hint="Folgt dem System, oder fest hell/dunkel.">
          <Select
            value={entwurf.theme}
            onChange={(e) =>
              setEntwurf({ ...entwurf, theme: e.target.value as BlitztextSettings['theme'] })
            }
          >
            <option value="system">System</option>
            <option value="hell">Hell</option>
            <option value="dunkel">Dunkel</option>
          </Select>
        </Field>
      )}
    </ZweiEbenenShell>
  )
}

interface KarteProps {
  anbieter: AnbieterKonfig
  istStandard: boolean
  standardWaehlen: () => void
  aendere: (patch: Partial<AnbieterKonfig>) => void
  entferne?: () => void
}

function AnbieterKarte({ anbieter, istStandard, standardWaehlen, aendere, entferne }: KarteProps) {
  const istCustom = getProvider(anbieter.vorlage)?.anpassbar ?? false
  const { asr, chat } = modelleFuerVorlage(anbieter.vorlage)
  const zeige = useHinweis()

  const [maske, setMaske] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [keyBusy, setKeyBusy] = useState(false)
  const [keyFehler, setKeyFehler] = useState<string | null>(null)

  useEffect(() => {
    void window.blitztext.apiKey.maske(anbieter.id).then(setMaske)
  }, [anbieter.id])

  async function speichereKey() {
    setKeyBusy(true)
    setKeyFehler(null)
    const v = await window.blitztext.apiKey.save(anbieter.id, keyInput.trim(), anbieter.baseUrl)
    if (v.status === 'valid') {
      setKeyInput('')
      setMaske(await window.blitztext.apiKey.maske(anbieter.id))
      zeige('Key getestet und gespeichert.', 'erfolg') // P6: Erfolg als Toast
    } else {
      // P6: Validierungsfehler bleibt INLINE am Feld (laufender Zustand, kein Ereignis).
      setKeyFehler(v.status === 'network-error' ? `Netzwerkfehler: ${v.message}` : 'Key ungültig.')
    }
    setKeyBusy(false)
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={standardWaehlen}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <span
            className={`flex size-4 items-center justify-center rounded-full border ${
              istStandard ? 'border-foreground' : 'border-muted-foreground'
            }`}
          >
            {istStandard && <span className="size-2 rounded-full bg-foreground" />}
          </span>
          {anbieter.label}
        </button>
        <div className="flex items-center gap-2">
          {istStandard && <Badge variant="outline">Standard</Badge>}
          {entferne && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={entferne}>
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      <Field label="Anzeigename" hint="Frei wählbarer Name dieses Anbieters in der Liste.">
        <Input value={anbieter.label} onChange={(e) => aendere({ label: e.target.value })} />
      </Field>

      {istCustom && (
        <Field label="Base-URL" hint="OpenAI-kompatibel, ohne Schrägstrich am Ende (…/v1).">
          <Input
            value={anbieter.baseUrl}
            placeholder="https://…/v1"
            onChange={(e) => aendere({ baseUrl: e.target.value })}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="ASR-Modell" hint="Modell für die Transkription (Sprache → Text).">
          {asr.length > 0 ? (
            <Select value={anbieter.asrModell} onChange={(e) => aendere({ asrModell: e.target.value })}>
              {asr.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.empfohlen ? ' (empfohlen)' : ''}
                </option>
              ))}
            </Select>
          ) : (
            <Input value={anbieter.asrModell} onChange={(e) => aendere({ asrModell: e.target.value })} />
          )}
        </Field>
        <Field label="Chat-Modell" hint="Modell für das Umschreiben des Transkripts.">
          {chat.length > 0 ? (
            <Select
              value={anbieter.chatModell}
              onChange={(e) => aendere({ chatModell: e.target.value })}
            >
              {chat.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.empfohlen ? ' (empfohlen)' : ''}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              value={anbieter.chatModell}
              onChange={(e) => aendere({ chatModell: e.target.value })}
            />
          )}
        </Field>
      </div>

      <Separator />
      <Field
        label="API-Key"
        hint={maske ? `Gespeichert: ${maske}…` : 'Wird verschlüsselt im Benutzerprofil gespeichert (DPAPI).'}
      >
        <div className="flex items-center gap-2">
          <Input
            type="password"
            placeholder={maske ? 'Neuen Key eingeben (ersetzt)' : 'sk-…'}
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value)
              setKeyFehler(null)
            }}
            disabled={keyBusy}
          />
          <Button size="sm" onClick={speichereKey} disabled={keyBusy || keyInput.trim() === ''}>
            {keyBusy ? 'Teste…' : 'Testen & speichern'}
          </Button>
        </div>
      </Field>
      {keyFehler && <p className="text-xs text-destructive">{keyFehler}</p>}
    </div>
  )
}
