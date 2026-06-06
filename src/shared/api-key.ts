// IPC-Vertrag für die API-Key-Validierung — geteilt zwischen Main, Preload und Renderer.
export type ApiKeyValidation =
  | { status: 'valid' }
  | { status: 'invalid' }
  | { status: 'network-error'; message: string }
