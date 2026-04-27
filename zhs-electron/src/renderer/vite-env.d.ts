/// <reference types="vite/client" />

import type {
  AutomationStatus,
  BrowserPageState,
  CourseTask,
  LogEntry,
  Settings
} from '../shared/types'

type Unsubscribe = () => void

interface ZhsApi {
  getTasks: () => Promise<CourseTask[]>
  addCurrentCourse: () => Promise<CourseTask>
  removeTask: (taskId: string) => Promise<CourseTask[]>
  runTask: (taskId?: string) => Promise<void>
  stopRun: () => Promise<void>
  getSettings: () => Promise<Settings>
  updateSettings: (settings: Partial<Settings>) => Promise<Settings>
  getPageState: () => Promise<BrowserPageState>
  navigate: (url: string) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  reload: () => Promise<void>
  openWebsiteDevTools: () => Promise<void>
  onTasksChanged: (listener: (tasks: CourseTask[]) => void) => Unsubscribe
  onSettingsChanged: (listener: (settings: Settings) => void) => Unsubscribe
  onPageStateChanged: (listener: (state: BrowserPageState) => void) => Unsubscribe
  onLog: (listener: (entry: LogEntry) => void) => Unsubscribe
  onAutomationStatus: (listener: (status: AutomationStatus) => void) => Unsubscribe
  onCaptchaState: (listener: (visible: boolean) => void) => Unsubscribe
}

declare global {
  interface Window {
    zhs: ZhsApi
  }
}
