import { app } from 'electron'
import Store from 'electron-store'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CourseTask, CourseType, Settings, TaskStatus } from '../shared/types'

const DEFAULT_SETTINGS: Settings = {
  limitMaxTime: 30,
  limitSpeed: 1,
  soundOff: true,
  preventSleep: true,
  language: 'en'
}

interface SettingsShape {
  settings: Settings
}

export class TaskRepository {
  private readonly settingsStore = new Store<SettingsShape>({
    name: 'settings',
    defaults: {
      settings: DEFAULT_SETTINGS
    }
  })

  private readonly tasksPath: string

  constructor() {
    this.tasksPath = join(app.getPath('userData'), 'tasks.json')
  }

  getTasks(): CourseTask[] {
    try {
      const parsed = JSON.parse(readFileSync(this.tasksPath, 'utf8')) as CourseTask[]
      return Array.isArray(parsed) ? parsed.map(normalizeTask) : []
    } catch {
      return []
    }
  }

  saveTasks(tasks: CourseTask[]): CourseTask[] {
    mkdirSync(dirname(this.tasksPath), { recursive: true })
    const normalized = tasks.map(normalizeTask)
    writeFileSync(this.tasksPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
    return normalized
  }

  addTask(url: string, title: string, type: CourseType): CourseTask {
    const now = new Date().toISOString()
    const tasks = this.getTasks()
    const existing = tasks.find((task) => task.url === url)
    if (existing) {
      return existing
    }

    const task: CourseTask = {
      id: crypto.randomUUID(),
      url,
      title: title.trim() || url,
      type,
      addedAt: now,
      updatedAt: now,
      status: 'pending',
      progress: '0%'
    }

    this.saveTasks([task, ...tasks])
    return task
  }

  updateTask(taskId: string, patch: Partial<CourseTask>): CourseTask[] {
    const now = new Date().toISOString()
    return this.saveTasks(
      this.getTasks().map((task) =>
        task.id === taskId
          ? normalizeTask({
              ...task,
              ...patch,
              updatedAt: now
            })
          : task
      )
    )
  }

  removeTask(taskId: string): CourseTask[] {
    return this.saveTasks(this.getTasks().filter((task) => task.id !== taskId))
  }

  recoverInterruptedTasks(): CourseTask[] {
    const tasks = this.getTasks()
    const hasInterruptedTasks = tasks.some(isInterruptedTask)

    if (!hasInterruptedTasks) {
      return tasks
    }

    const now = new Date().toISOString()
    return this.saveTasks(
      tasks.map((task) =>
        isInterruptedTask(task)
          ? {
              ...task,
              status: 'pending',
              currentLesson: undefined,
              error: undefined,
              updatedAt: now
            }
          : task
      )
    )
  }

  getSettings(): Settings {
    return normalizeSettings(this.settingsStore.get('settings', DEFAULT_SETTINGS))
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const settings = normalizeSettings({ ...this.getSettings(), ...patch })
    this.settingsStore.set('settings', settings)
    return settings
  }
}

function normalizeTask(task: CourseTask): CourseTask {
  return {
    ...task,
    title: task.title || task.url,
    status: normalizeStatus(task.status),
    progress: task.progress || '0%',
    updatedAt: task.updatedAt || task.addedAt || new Date().toISOString()
  }
}

function normalizeStatus(status: TaskStatus): TaskStatus {
  return ['pending', 'running', 'paused', 'completed', 'failed'].includes(status) ? status : 'pending'
}

function isInterruptedTask(task: CourseTask): boolean {
  return task.status === 'running' || task.status === 'paused'
}

function normalizeSettings(settings: Settings): Settings {
  const speed = Number.isFinite(settings.limitSpeed) ? settings.limitSpeed : DEFAULT_SETTINGS.limitSpeed
  const limitMaxTime = Number.isFinite(settings.limitMaxTime)
    ? Math.max(0, settings.limitMaxTime)
    : DEFAULT_SETTINGS.limitMaxTime

  return {
    limitMaxTime,
    limitSpeed: Math.min(1.8, Math.max(0.5, speed)),
    soundOff: Boolean(settings.soundOff),
    preventSleep: settings.preventSleep !== false,
    language: 'en'
  }
}
