import { cn } from '@/lib/utils'

// Zugänglicher Schalter ohne Radix: nativer Checkbox-Input (peer) + gestylte Spur/Knopf.
// Tastatur/Screenreader funktionieren über den echten Checkbox-Input.
export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onCheckedChange, id, disabled, className }: SwitchProps) {
  return (
    <label className={cn('relative inline-flex cursor-pointer items-center', disabled && 'cursor-not-allowed opacity-50', className)}>
      <input
        type="checkbox"
        id={id}
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span
        className={cn(
          'h-5 w-9 rounded-full bg-input transition-colors',
          'peer-checked:bg-primary',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background'
        )}
      />
      <span className="pointer-events-none absolute left-0.5 size-4 rounded-full bg-background transition-transform peer-checked:translate-x-4" />
    </label>
  )
}
