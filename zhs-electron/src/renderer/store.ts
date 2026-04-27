import { create } from 'zustand'
import type { AutomationStatus, BrowserPageState, CourseTask, LogEntry, Settings } from '../shared/types'

const emptyPageState: BrowserPageState = {
  url: '',
  title: '',
  courseType: null,
  canGoBack: false,
  canGoForward: false
}

const defaultSettings: Settings = {
  limitMaxTime: 30,
  limitSpeed: 1,
  soundOff: true,
  preventSleep: true,
  language: 'en'
}

interface AppStore {
  tasks: CourseTask[]
  settings: Settings
  pageState: BrowserPageState
  logs: LogEntry[]
  automation: AutomationStatus
  captchaVisible: boolean
  error?: string
  initialized: boolean
  init: () => Promise<void>
  addCurrentCourse: () => Promise<void>
  removeTask: (taskId: string) => Promise<void>
  runTask: (taskId?: string) => Promise<void>
  stopRun: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  navigate: (url: string) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  reload: () => Promise<void>
  openWebsiteDevTools: () => Promise<void>
  clearError: () => void
}

let subscriptionsStarted = false

export const useAppStore = create<AppStore>((set, get) => ({
  tasks: [],
  settings: defaultSettings,
  pageState: emptyPageState,
  logs: [],
  automation: { state: 'idle', message: 'Idle' },
  captchaVisible: false,
  initialized: false,

  init: async () => {
    if (!subscriptionsStarted) {
      subscriptionsStarted = true
      window.zhs.onTasksChanged((tasks) => set({ tasks }))
      window.zhs.onSettingsChanged((settings) => set({ settings }))
      window.zhs.onPageStateChanged((pageState) => set({ pageState }))
      window.zhs.onLog((entry) =>
        set((state) => ({
          logs: [entry, ...state.logs].slice(0, 250)
        }))
      )
      window.zhs.onAutomationStatus((automation) => set({ automation }))
      window.zhs.onCaptchaState((captchaVisible) => set({ captchaVisible }))
    }

    const [tasks, settings, pageState] = await Promise.all([
      window.zhs.getTasks(),
      window.zhs.getSettings(),
      window.zhs.getPageState()
    ])
    set({ tasks, settings, pageState, initialized: true })
  },

  addCurrentCourse: async () => {
    try {
      await window.zhs.addCurrentCourse()
      set({ error: undefined })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  removeTask: async (taskId) => {
    const tasks = await window.zhs.removeTask(taskId)
    set({ tasks })
  },

  runTask: async (taskId) => {
    await window.zhs.runTask(taskId)
  },

  stopRun: async () => {
    await window.zhs.stopRun()
  },

  updateSettings: async (patch) => {
    const settings = await window.zhs.updateSettings(patch)
    set({ settings })
  },

  navigate: async (url) => {
    await window.zhs.navigate(url)
  },

  goBack: async () => {
    await window.zhs.goBack()
  },

  goForward: async () => {
    await window.zhs.goForward()
  },

  reload: async () => {
    await window.zhs.reload()
  },

  openWebsiteDevTools: async () => {
    await window.zhs.openWebsiteDevTools()
  },

  clearError: () => {
    if (get().error) {
      set({ error: undefined })
    }
  }
}))
