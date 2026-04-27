import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function configureStableUserDataPath(): void {
  app.setName('ZHS Autovisor')
  const userDataPath = join(app.getPath('appData'), 'ZHS Autovisor')
  const sessionDataPath = join(userDataPath, 'Session Data')
  mkdirSync(userDataPath, { recursive: true })
  mkdirSync(sessionDataPath, { recursive: true })
  app.setPath('userData', userDataPath)
  app.setPath('sessionData', sessionDataPath)
}
