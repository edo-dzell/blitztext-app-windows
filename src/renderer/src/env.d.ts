/// <reference types="vite/client" />
import type { BlitztextApi } from '../../preload'

declare global {
  interface Window {
    blitztext: BlitztextApi
  }
}
