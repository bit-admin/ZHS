import { contextBridge, ipcRenderer } from 'electron'
import type {
  AutomationStatus,
  BrowserPageState,
  CourseTask,
  LogEntry,
  Settings
} from '../shared/types'

type Unsubscribe = () => void

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  getTasks: () => ipcRenderer.invoke('tasks:get') as Promise<CourseTask[]>,
  addCurrentCourse: () => ipcRenderer.invoke('tasks:add-current-course') as Promise<CourseTask>,
  removeTask: (taskId: string) => ipcRenderer.invoke('tasks:remove', taskId) as Promise<CourseTask[]>,
  runTask: (taskId?: string) => ipcRenderer.invoke('tasks:run', taskId) as Promise<void>,
  stopRun: () => ipcRenderer.invoke('tasks:stop') as Promise<void>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<Settings>,
  updateSettings: (settings: Partial<Settings>) =>
    ipcRenderer.invoke('settings:update', settings) as Promise<Settings>,
  getPageState: () => ipcRenderer.invoke('browser:get-page-state') as Promise<BrowserPageState>,
  navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url) as Promise<void>,
  goBack: () => ipcRenderer.invoke('browser:back') as Promise<void>,
  goForward: () => ipcRenderer.invoke('browser:forward') as Promise<void>,
  reload: () => ipcRenderer.invoke('browser:reload') as Promise<void>,
  openWebsiteDevTools: () => ipcRenderer.invoke('browser:open-devtools') as Promise<void>,
  onTasksChanged: (listener: (tasks: CourseTask[]) => void) => subscribe('tasks:changed', listener),
  onSettingsChanged: (listener: (settings: Settings) => void) => subscribe('settings:changed', listener),
  onPageStateChanged: (listener: (state: BrowserPageState) => void) =>
    subscribe('browser:page-state', listener),
  onLog: (listener: (entry: LogEntry) => void) => subscribe('log:entry', listener),
  onAutomationStatus: (listener: (status: AutomationStatus) => void) =>
    subscribe('automation:status', listener),
  onCaptchaState: (listener: (visible: boolean) => void) => subscribe('captcha:state', listener)
}

contextBridge.exposeInMainWorld('zhs', api)
