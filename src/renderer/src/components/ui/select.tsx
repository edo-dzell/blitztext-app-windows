import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Eigenes, voll gestyltes Dropdown (Listbox) als Drop-in-Ersatz für das native <select>. Grund: das
// native Popup ist auf Windows ein OS-Win32-Menü → `color-scheme`/`option`-CSS greifen NICHT (weiß-auf-
// weiß + blaues OS-Hover im Dunkelmodus); `appearance: base-select` erst ab Chromium 135 (wir: 130).
// Design-Recherche + Kritiker validiert. PFLICHT war ein Portal (sonst Clipping durch overflow-auto/
// overflow-hidden in App-Content/ZweiEbenenShell). API bleibt identisch: value / onChange({target:{value}})
// / <option value=…>label</option>-Children → Aufrufer unverändert.

type SelectProps = {
  value?: string
  onChange?: (e: { target: { value: string } }) => void
  children?: ReactNode
  className?: string
  disabled?: boolean
  id?: string
  name?: string
  'aria-label'?: string
}

interface Item {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface PanelPos {
  left: number
  width: number
  top?: number
  bottom?: number
}

const PANEL_MAX_H = 240 // = max-h-60
const ABSTAND = 4

// Liest <option value=…>label</option>-Children aus, damit die Aufrufer unverändert bleiben.
function leseOptionen(children: ReactNode): Item[] {
  const items: Item[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean }
    items.push({ value: String(props.value ?? ''), label: props.children, disabled: props.disabled })
  })
  return items
}

export function Select({
  value,
  onChange,
  children,
  className,
  disabled,
  id,
  name,
  'aria-label': ariaLabel
}: SelectProps) {
  const items = useMemo(() => leseOptionen(children), [children])
  const [offen, setOffen] = useState(false)
  const [aktiv, setAktiv] = useState(0)
  const [pos, setPos] = useState<PanelPos | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLUListElement>(null)
  const reactId = useId()
  const listId = `${id ?? reactId}-listbox`

  const ausgewaehlt = items.find((i) => i.value === value)
  const aktuellerIndex = Math.max(
    0,
    items.findIndex((i) => i.value === value)
  )

  // Panel-Position aus dem Trigger berechnen (position: fixed, Breite an Trigger gekoppelt). Nach oben
  // kippen, wenn unten kein Platz ist. Wird bei Scroll/Resize neu berechnet.
  const berechnePos = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const platzUnten = window.innerHeight - r.bottom
    const benoetigt = Math.min(PANEL_MAX_H, items.length * 34 + 8)
    if (platzUnten < benoetigt && r.top > platzUnten) {
      setPos({ left: r.left, width: r.width, bottom: window.innerHeight - r.top + ABSTAND })
    } else {
      setPos({ left: r.left, width: r.width, top: r.bottom + ABSTAND })
    }
  }, [items.length])

  const oeffne = useCallback(() => {
    if (disabled || items.length === 0) return
    setAktiv(aktuellerIndex)
    berechnePos()
    setOffen(true)
  }, [disabled, items.length, aktuellerIndex, berechnePos])

  const schliesseUndFokus = useCallback(() => {
    setOffen(false)
    triggerRef.current?.focus()
  }, [])

  const waehle = useCallback(
    (item: Item) => {
      if (item.disabled) return
      onChange?.({ target: { value: item.value } })
      schliesseUndFokus()
    },
    [onChange, schliesseUndFokus]
  )

  // Neu positionieren bei Scroll (capture: erfasst auch innere overflow-auto-Container!) + Resize.
  useEffect(() => {
    if (!offen) return
    const onMove = (): void => berechnePos()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [offen, berechnePos])

  // Klick außerhalb (Trigger UND Panel — Panel hängt am body) schließt.
  useEffect(() => {
    if (!offen) return
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOffen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [offen])

  // Aktiven Eintrag ins Sichtfeld scrollen.
  useLayoutEffect(() => {
    if (!offen) return
    const el = panelRef.current?.children[aktiv] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [offen, aktiv])

  const naechster = (start: number, dir: 1 | -1): number => {
    let i = start
    for (let n = 0; n < items.length; n++) {
      i = (i + dir + items.length) % items.length
      if (!items[i]?.disabled) return i
    }
    return start
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (disabled) return
    if (!offen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        oeffne()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setAktiv((i) => naechster(i, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setAktiv((i) => naechster(i, -1))
        break
      case 'Home':
        e.preventDefault()
        setAktiv(naechster(-1, 1))
        break
      case 'End':
        e.preventDefault()
        setAktiv(naechster(items.length, -1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (items[aktiv]) waehle(items[aktiv])
        break
      case 'Escape':
        e.preventDefault()
        schliesseUndFokus()
        break
      case 'Tab':
        setOffen(false)
        break
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={offen}
        aria-label={ariaLabel}
        onClick={() => (offen ? setOffen(false) : oeffne())}
        onKeyDown={onKey}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border bg-input/30 px-3 py-1 text-left text-sm text-foreground shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      >
        <span className="truncate">{ausgewaehlt?.label ?? ''}</span>
        <ChevronDown className="pointer-events-none ml-2 size-4 shrink-0 text-muted-foreground" />
      </button>

      {offen &&
        pos &&
        createPortal(
          <ul
            ref={panelRef}
            role="listbox"
            id={listId}
            tabIndex={-1}
            aria-activedescendant={items[aktiv] ? `${listId}-opt-${aktiv}` : undefined}
            style={{
              position: 'fixed',
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom
            }}
            className="z-50 max-h-60 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {items.map((item, idx) => {
              const istAusgewaehlt = item.value === value
              const istAktiv = idx === aktiv
              return (
                <li
                  key={`${item.value}-${idx}`}
                  id={`${listId}-opt-${idx}`}
                  role="option"
                  aria-selected={istAusgewaehlt}
                  aria-disabled={item.disabled}
                  onMouseEnter={() => !item.disabled && setAktiv(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => waehle(item)}
                  className={cn(
                    'flex cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm',
                    istAktiv && 'bg-accent text-accent-foreground',
                    istAusgewaehlt && 'font-medium',
                    item.disabled && 'pointer-events-none opacity-50'
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {istAusgewaehlt && <Check className="size-4 shrink-0" />}
                </li>
              )
            })}
          </ul>,
          document.body
        )}
    </div>
  )
}
