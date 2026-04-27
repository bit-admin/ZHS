import { ipcMain } from 'electron'
import type {
  CourseType,
  ElementRect,
  LessonSnapshot,
  OptimizePageResult,
  ProgressSnapshot,
  QuestionTargets,
  Settings,
  VideoSnapshot
} from '../shared/types'

interface ProbeEnvelope {
  id: string
  kind: string
  payload?: unknown
}

interface ProbeResponse<T = unknown> {
  id: string
  ok: boolean
  value?: T
  error?: string
}

type PendingProbe = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

export class WebsiteProbeClient {
  private sequence = 0
  private readonly pending = new Map<string, PendingProbe>()
  private readonly handleProbeResult = (event: Electron.IpcMainEvent, response: ProbeResponse): void => {
    if (event.sender.id !== this.contents.id) {
      return
    }

    const pending = this.pending.get(response.id)
    if (!pending) {
      return
    }

    clearTimeout(pending.timer)
    this.pending.delete(response.id)

    if (response.ok) {
      pending.resolve(response.value)
    } else {
      pending.reject(new Error(response.error || 'Website probe failed'))
    }
  }

  constructor(private readonly contents: Electron.WebContents) {
    ipcMain.on('zhs:probe-result', this.handleProbeResult)
  }

  dispose(): void {
    ipcMain.removeListener('zhs:probe-result', this.handleProbeResult)
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Website probe client disposed'))
    }
    this.pending.clear()
  }

  request<T>(kind: string, payload?: unknown, timeoutMs = 8000): Promise<T> {
    if (this.contents.isDestroyed()) {
      return Promise.reject(new Error('Website view has been destroyed'))
    }

    const id = `probe-${Date.now()}-${++this.sequence}`
    const envelope: ProbeEnvelope = { id, kind, payload }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Website probe timed out: ${kind}`))
      }, timeoutMs)

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer
      })

      this.contents.send('zhs:probe', envelope)
    })
  }

  configureWatchdog(settings: Settings): void {
    if (!this.contents.isDestroyed()) {
      this.contents.send('zhs:watchdog-config', settings)
    }
  }

  stopWatchdog(): void {
    if (!this.contents.isDestroyed()) {
      this.contents.send('zhs:watchdog-stop')
    }
  }
}

export function optimizePage(
  probe: WebsiteProbeClient,
  type: CourseType
): Promise<OptimizePageResult> {
  return probe.request<OptimizePageResult>('optimizePage', { type }, 5000)
}

export function getCourseTitle(probe: WebsiteProbeClient, type: CourseType): Promise<string> {
  return probe.request<string>('courseTitle', { type }, 5000)
}

export function enumerateLessons(
  probe: WebsiteProbeClient,
  type: CourseType,
  includeAll: boolean
): Promise<LessonSnapshot[]> {
  return probe.request<LessonSnapshot[]>('enumerateLessons', { type, includeAll }, 8000)
}

export function getLessonRect(
  probe: WebsiteProbeClient,
  type: CourseType,
  index: number
): Promise<ElementRect | null> {
  return probe.request<ElementRect | null>('lessonRect', { type, index }, 4000)
}

export function getLessonName(probe: WebsiteProbeClient, type: CourseType): Promise<string> {
  return probe.request<string>('lessonName', { type }, 5000)
}

export function getProgress(probe: WebsiteProbeClient, type: CourseType): Promise<ProgressSnapshot> {
  return probe.request<ProgressSnapshot>('progress', { type }, 5000)
}

export function getVideoAreaRect(probe: WebsiteProbeClient): Promise<ElementRect | null> {
  return probe.request<ElementRect | null>('videoAreaRect', undefined, 3000)
}

export function getVideoState(probe: WebsiteProbeClient): Promise<VideoSnapshot> {
  return probe.request<VideoSnapshot>('videoState', undefined, 5000)
}

export function resetVideoTime(probe: WebsiteProbeClient): Promise<boolean> {
  return probe.request<boolean>('resetVideoTime', undefined, 5000)
}

export function getQuestionTargets(
  probe: WebsiteProbeClient,
  type: CourseType
): Promise<QuestionTargets> {
  return probe.request<QuestionTargets>('questionTargets', { type }, 4000)
}
