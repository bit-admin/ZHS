import { app } from 'electron'
import type { AutomationStatus, BrowserPageState, CourseTask, LogEntry, Settings } from '../shared/types'
import { configureStableUserDataPath } from './app-paths'
import { registerIpc } from './ipc'
import { WebsiteProbeClient } from './lessons'
import { isIgnorableLoadFailure, loadUrl } from './navigation'
import { AutomationOrchestrator } from './orchestrator'
import {
  DEFAULT_START_URL,
  getWebsiteSession,
  persistWebsiteSession,
  restoreWebsiteSession,
  watchWebsiteSessionPersistence
} from './session'
import { SleepBlocker } from './sleep-blocker'
import { TaskRepository } from './store'
import { classifyCourseUrl } from './url'
import { createAppViews } from './views'

configureStableUserDataPath()

let probe: WebsiteProbeClient | undefined
let stopSessionPersistenceWatch: (() => void) | undefined
let sleepBlocker: SleepBlocker | undefined

function send<T>(window: Electron.BrowserWindow, channel: string, payload: T): void {
  if (!window.isDestroyed()) {
    window.webContents.send(channel, payload)
  }
}

app.whenReady().then(async () => {
  const repository = new TaskRepository()
  repository.recoverInterruptedTasks()
  const sleepBlockerManager = new SleepBlocker()
  sleepBlocker = sleepBlockerManager
  sleepBlockerManager.apply(repository.getSettings())
  const websiteSession = getWebsiteSession()
  await restoreWebsiteSession(websiteSession)
  stopSessionPersistenceWatch = watchWebsiteSessionPersistence(websiteSession)
  const { window, websiteView } = await createAppViews(websiteSession)

  probe = new WebsiteProbeClient(websiteView.webContents)

  const broadcastTasks = (tasks: CourseTask[]): void => send(window, 'tasks:changed', tasks)
  const broadcastSettings = (settings: Settings): void => send(window, 'settings:changed', settings)
  const broadcastLog = (entry: LogEntry): void => send(window, 'log:entry', entry)
  const broadcastStatus = (status: AutomationStatus): void => send(window, 'automation:status', status)
  const broadcastPageState = (): void => {
    const state = getPageState()
    send(window, 'browser:page-state', state)
  }

  const orchestrator = new AutomationOrchestrator(websiteView.webContents, probe, repository, {
    onTasksChanged: broadcastTasks,
    onLog: broadcastLog,
    onStatus: broadcastStatus
  })

  const getPageState = (): BrowserPageState => ({
    url: websiteView.webContents.getURL(),
    title: websiteView.webContents.getTitle(),
    courseType: classifyCourseUrl(websiteView.webContents.getURL()),
    canGoBack: websiteView.webContents.canGoBack(),
    canGoForward: websiteView.webContents.canGoForward()
  })

  registerIpc({
    window,
    websiteView,
    probe,
    repository,
    orchestrator,
    sleepBlocker: sleepBlockerManager,
    getPageState,
    broadcastTasks,
    broadcastSettings,
    broadcastLog,
    broadcastStatus
  })

  websiteView.webContents.on('did-navigate', broadcastPageState)
  websiteView.webContents.on('did-navigate-in-page', broadcastPageState)
  websiteView.webContents.on('page-title-updated', broadcastPageState)
  websiteView.webContents.on('did-finish-load', () => {
    probe?.configureWatchdog(repository.getSettings())
    void persistWebsiteSession(websiteSession)
    broadcastPageState()
  })
  websiteView.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isIgnorableLoadFailure(errorCode, isMainFrame)) {
      broadcastPageState()
      return
    }

    broadcastLog({
      id: crypto.randomUUID(),
      level: 'error',
      message: `Browser load failed (${errorCode}): ${errorDescription || validatedURL}`,
      createdAt: new Date().toISOString()
    })
    broadcastPageState()
  })

  window.on('closed', () => {
    void persistWebsiteSession(websiteSession)
    probe?.dispose()
    probe = undefined
  })

  app.on('before-quit', () => {
    sleepBlockerManager.stop('app quitting')
    void persistWebsiteSession(websiteSession)
  })

  await loadUrl(websiteView.webContents, DEFAULT_START_URL).catch((error: unknown) => {
    broadcastLog({
      id: crypto.randomUUID(),
      level: 'error',
      message: error instanceof Error ? error.message : String(error),
      createdAt: new Date().toISOString()
    })
  })

  app.on('activate', () => {
    if (window.isDestroyed()) {
      void app.relaunch()
    } else {
      window.show()
    }
  })
})

app.on('window-all-closed', () => {
  stopSessionPersistenceWatch?.()
  probe?.dispose()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
