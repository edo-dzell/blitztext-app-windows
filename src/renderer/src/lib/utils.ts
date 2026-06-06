import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn-Standard: Tailwind-Klassen zusammenführen + Konflikte auflösen. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
