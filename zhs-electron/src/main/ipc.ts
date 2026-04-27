import { ipcMain } from 'electron'
import type { AutomationStatus, BrowserPageState, CourseTask, LogEntry, Settings } from '../shared/types'
import { getCourseTitle, WebsiteProbeClient } from './lessons'
import { loadUrl } from './navigation'
import { AutomationOrchestrator } from './orchestrator'
import { SleepBlocker } from './sleep-blocker'
import { TaskRepository } from './store'
import { classifyCourseUrl, normalizeNavigationUrl } from './url'

interface RegisterIpcOptions {
  window: Electron.BrowserWindow
  websiteView: Electron.WebContentsView
  probe: WebsiteProbeClient
  repository: TaskRepository
  orchestrator: AutomationOrchestrator
  sleepBlocker: SleepBlocker
  getPageState: () => BrowserPageState
  broadcastTasks: (tasks: CourseTask[]) => void
  broadcastSettings: (settings: Settings) => void
  broadcastLog: (entry: LogEntry) => void
  broadcastStatus: (status: AutomationStatus) => void
}

export function registerIpc(options: RegisterIpcOptions): void {
  const {
    websiteView,
    probe,
    repository,
    orchestrator,
    sleepBlocker,
    getPageState,
    broadcastTasks,
    broadcastSettings,
    broadcastLog,
    broadcastStatus
  } = options

  ipcMain.handle('tasks:get', () => repository.getTasks())

  ipcMain.handle('tasks:add-current-course', async () => {
    const url = websiteView.webContents.getURL()
    const type = classifyCourseUrl(url)
    if (!type) {
      throw new Error('The current page is not recognized as a course page.')
    }

    const title = await getCourseTitle(probe, type).catch(() => websiteView.webContents.getTitle())
    const task = repository.addTask(url, title, type)
    broadcastTasks(repository.getTasks())
    broadcastLog(makeLog('info', `Added course: ${task.title}`, task.id))
    return task
  })

  ipcMain.handle('tasks:remove', (_event, taskId: string) => {
    const tasks = repository.removeTask(taskId)
    broadcastTasks(tasks)
    return tasks
  })

  ipcMain.handle('tasks:run', async (_event, taskId?: string) => {
    void orchestrator.run(taskId)
  })

  ipcMain.handle('tasks:stop', async () => {
    await orchestrator.stop()
  })

  ipcMain.handle('settings:get', () => repository.getSettings())

  ipcMain.handle('settings:update', (_event, patch: Partial<Settings>) => {
    const settings = repository.updateSettings(patch)
    probe.configureWatchdog(settings)
    sleepBlocker.apply(settings)
    broadcastSettings(settings)
    return settings
  })

  ipcMain.handle('browser:get-page-state', getPageState)

  ipcMain.handle('browser:navigate', async (_event, input: string) => {
    await loadUrl(websiteView.webContents, normalizeNavigationUrl(input))
  })

  ipcMain.handle('browser:back', () => {
    if (websiteView.webContents.canGoBack()) {
      websiteView.webContents.goBack()
    }
  })

  ipcMain.handle('browser:forward', () => {
    if (websiteView.webContents.canGoForward()) {
      websiteView.webContents.goForward()
    }
  })

  ipcMain.handle('browser:reload', () => {
    websiteView.webContents.reload()
  })

  ipcMain.handle('browser:open-devtools', () => {
    websiteView.webContents.openDevTools({ mode: 'detach' })
  })

  ipcMain.on('zhs:captcha-state', (event, payload: { visible: boolean }) => {
    if (event.sender.id !== websiteView.webContents.id) {
      return
    }
    orchestrator.setCaptchaVisible(Boolean(payload.visible))
    options.window.webContents.send('captcha:state', Boolean(payload.visible))
  })

  ipcMain.on('zhs:log', (event, payload: { level?: LogEntry['level']; message?: string }) => {
    if (event.sender.id !== websiteView.webContents.id || !payload.message) {
      return
    }
    broadcastLog(makeLog(payload.level || 'info', payload.message))
  })

  broadcastTasks(repository.getTasks())
  broadcastSettings(repository.getSettings())
  broadcastStatus({ state: 'idle', message: 'Idle' })
}

function makeLog(level: LogEntry['level'], message: string, taskId?: string): LogEntry {
  return {
    id: crypto.randomUUID(),
    level,
    message,
    taskId,
    createdAt: new Date().toISOString()
  }
}
