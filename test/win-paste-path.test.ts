import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { winPastePfad } from '@main/output/win-paste-path'

describe('winPastePfad', () => {
  it('verpackt: Helfer liegt neben den extraResources (process.resourcesPath)', () => {
    const pfad = winPastePfad({
      istVerpackt: true,
      resourcesPath: '/opt/Blitztext/resources',
      appPfad: '/opt/Blitztext/resources/app.asar'
    })
    expect(pfad).toBe(join('/opt/Blitztext/resources', 'win-paste.exe'))
  })

  it('dev: Helfer liegt unter <appPfad>/resources (gleicher Codepfad, anderer Anker)', () => {
    const pfad = winPastePfad({
      istVerpackt: false,
      resourcesPath: '/ignored',
      appPfad: '/opt/blitztext'
    })
    expect(pfad).toBe(join('/opt/blitztext', 'resources', 'win-paste.exe'))
  })
})
