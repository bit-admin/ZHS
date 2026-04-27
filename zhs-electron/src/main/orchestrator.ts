import { randomUUID } from 'node:crypto'
import type { CourseTask, LogEntry } from '../shared/types'
import { clickRect, moveMouseOverRect, pressKey, settle } from './input'
import {
  enumerateLessons,
  getLessonName,
  getLessonReadiness,
  getLessonRect,
  getProgress,
  getQuestionTargets,
  getVideoAreaRect,
  getVideoState,
  optimizePage,
  resetVideoTime,
  WebsiteProbeClient
} from './lessons'
import { loadUrl } from './navigation'
import { TaskRepository } from './store'

type StatusState = 'idle' | 'running' | 'captcha' | 'stopping'

interface OrchestratorEvents {
  onTasksChanged: (tasks: CourseTask[]) => void
  onLog: (entry: LogEntry) => void
  onStatus: (status: { state: StatusState; taskId?: string; message?: string }) => void
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export class AutomationOrchestrator {
  private running = false
  private stopping = false
  private captchaVisible = false
  private currentTaskId: string | undefined
  private lastStudyingLogKey: string | undefined

  constructor(
    private readonly contents: Electron.WebContents,
    private readonly probe: WebsiteProbeClient,
    private readonly repository: TaskRepository,
    private readonly events: OrchestratorEvents
  ) {}

  async run(taskId?: string): Promise<void> {
    if (this.running) {
      this.log('warn', 'A task run is already active.')
      return
    }

    this.running = true
    this.stopping = false
    this.lastStudyingLogKey = undefined
    this.emitStatus('running', taskId, 'Starting task queue')

    try {
      const queue = this.buildQueue(taskId)
      if (queue.length === 0) {
        this.log('info', 'No pending courses to run.')
        return
      }

      for (const task of queue) {
        if (this.stopping) {
          break
        }
        await this.runTask(task)
      }
    } catch (error) {
      this.log('error', error instanceof Error ? error.message : String(error), this.currentTaskId)
    } finally {
      this.currentTaskId = undefined
      this.running = false
      this.stopping = false
      this.probe.stopWatchdog()
      this.emitStatus('idle', undefined, 'Idle')
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return
    }

    this.stopping = true
    this.probe.stopWatchdog()
    this.emitStatus('stopping', this.currentTaskId, 'Stopping after the current step')
    if (this.currentTaskId) {
      this.patchTask(this.currentTaskId, { status: 'pending' })
    }
  }

  setCaptchaVisible(visible: boolean): void {
    this.captchaVisible = visible
    if (!this.running || !this.currentTaskId) {
      return
    }

    if (visible) {
      this.patchTask(this.currentTaskId, { status: 'paused' })
      this.emitStatus('captcha', this.currentTaskId, 'Please complete the captcha in the browser.')
      this.log('warn', 'Captcha detected. Waiting for manual completion.', this.currentTaskId)
    } else {
      this.patchTask(this.currentTaskId, { status: 'running' })
      this.emitStatus('running', this.currentTaskId, 'Captcha cleared; resuming.')
      this.log('info', 'Captcha cleared. Resuming the task.', this.currentTaskId)
    }
  }

  private buildQueue(taskId?: string): CourseTask[] {
    const tasks = this.repository.getTasks()
    if (taskId) {
      return tasks.filter((task) => task.id === taskId)
    }
    return tasks.filter((task) => task.status === 'pending' || task.status === 'failed')
  }

  private async runTask(task: CourseTask): Promise<void> {
    this.currentTaskId = task.id
    const startedAt = Date.now()
    const settings = this.repository.getSettings()

    this.patchTask(task.id, {
      status: 'running',
      progress: task.progress || '0%',
      error: undefined,
      lastRunAt: new Date().toISOString()
    })
    this.emitStatus('running', task.id, `Loading ${task.title}`)
    this.log('info', `Loading course: ${task.title}`, task.id)

    try {
      await loadUrl(this.contents, task.url)
      await settle(1500)
      this.probe.configureWatchdog(settings)

      const optimization = await optimizePage(this.probe, task.type)
      for (const rect of optimization.clickRects) {
        await clickRect(this.contents, rect)
      }
      if (optimization.removedSelectors.length > 0) {
        this.log('info', `Removed page widgets: ${optimization.removedSelectors.join(', ')}`, task.id)
      }

      await this.waitForLessonState(task.type, task.id)
      const unfinished = await enumerateLessons(this.probe, task.type, false)
      const lessonPlan =
        unfinished.length > 0 ? unfinished : await enumerateLessons(this.probe, task.type, true)
      const reviewMode = unfinished.length === 0

      if (lessonPlan.length === 0) {
        this.log('warn', 'No lessons were found on the current course page.', task.id)
        this.patchTask(task.id, { status: 'completed', progress: '100%' })
        return
      }

      if (reviewMode) {
        this.log('info', 'No unfinished lessons found; reviewing available lessons.', task.id)
      } else {
        this.log('info', `Found ${lessonPlan.length} unfinished lesson(s).`, task.id)
      }

      for (const lesson of lessonPlan) {
        this.assertNotStopping()
        await this.waitWhileCaptcha()

        const rect = await getLessonRect(this.probe, task.type, lesson.index)
        const clicked = await clickRect(this.contents, rect)
        if (!clicked) {
          this.log('warn', `Could not click lesson ${lesson.index + 1}; skipping.`, task.id)
          continue
        }

        await this.waitForLessonActivation(task.type, lesson.index)
        const lessonName = await getLessonName(this.probe, task.type).catch(() => lesson.title)
        this.patchTask(task.id, { currentLesson: lessonName })
        this.logStudying(task.id, lessonName)

        await this.waitForVideo()
        this.probe.configureWatchdog(this.repository.getSettings())
        if (reviewMode) {
          await resetVideoTime(this.probe).catch(() => false)
        }

        await this.watchLesson(task, startedAt, reviewMode)
      }

      this.patchTask(task.id, {
        status: 'completed',
        progress: '100%',
        currentLesson: undefined
      })
      this.log('info', `Course complete: ${task.title}`, task.id)
    } catch (error) {
      if (error instanceof StopCurrentTask) {
        return
      }

      if (this.stopping) {
        this.patchTask(task.id, { status: 'pending' })
        this.log('info', `Stopped: ${task.title}`, task.id)
        return
      }

      const message = error instanceof Error ? error.message : String(error)
      this.patchTask(task.id, { status: 'failed', error: message })
      this.log('error', message, task.id)
    }
  }

  private async watchLesson(
    task: CourseTask,
    startedAt: number,
    reviewMode: boolean
  ): Promise<void> {
    while (!this.stopping) {
      await this.waitWhileCaptcha()
      const settings = this.repository.getSettings()
      const limitMinutes = settings.limitMaxTime
      this.probe.configureWatchdog(settings)
      await this.skipQuestions(task)

      if (limitMinutes > 0 && (Date.now() - startedAt) / 60000 >= limitMinutes) {
        this.log('info', `Time limit reached (${limitMinutes} min). Moving to the next course.`, task.id)
        this.patchTask(task.id, { status: 'completed', currentLesson: undefined })
        throw new StopCurrentTask()
      }

      if (reviewMode) {
        const video = await getVideoState(this.probe)
        const finished = video.exists && video.duration > 0 && video.currentTime >= video.duration - 0.5
        const progress = video.duration > 0 ? `${Math.min(100, Math.round((video.currentTime / video.duration) * 100))}%` : '0%'
        this.patchTask(task.id, { progress })
        if (finished) {
          return
        }
      } else {
        await this.moveMouseOverVideoArea()
        const progress = await getProgress(this.probe, task.type)
        this.patchTask(task.id, { progress: progress.text })
        if (progress.finished) {
          return
        }
      }

      await sleep(1000)
    }
  }

  private async waitForLessonState(type: CourseTask['type'], taskId: string): Promise<void> {
    let deadline = Date.now() + 30000
    let firstSeenAt = 0
    let stableSince = 0
    let lastSignature = ''

    while (Date.now() < deadline) {
      this.assertNotStopping()
      if (await this.waitWhileCaptcha()) {
        deadline = Date.now() + 30000
        firstSeenAt = 0
        stableSince = 0
        lastSignature = ''
      }

      const readiness = await getLessonReadiness(this.probe, type).catch(() => undefined)
      if (!readiness || readiness.count === 0) {
        await sleep(500)
        continue
      }

      const now = Date.now()
      if (firstSeenAt === 0) {
        firstSeenAt = now
        stableSince = now
        lastSignature = readiness.signature
      } else if (readiness.signature !== lastSignature) {
        stableSince = now
        lastSignature = readiness.signature
      }

      const stableFor = now - stableSince
      const elapsedSinceFirstRows = now - firstSeenAt
      const progressReady = type !== 'fusioncourseh5' || readiness.progressCount >= readiness.count
      const hasCompletionSignal = readiness.doneCount > 0 || readiness.progressCount > 0
      const noSignalGraceElapsed = elapsedSinceFirstRows >= 8000

      if (progressReady && stableFor >= 1500 && (hasCompletionSignal || noSignalGraceElapsed)) {
        await settle(500)
        return
      }

      await sleep(500)
    }

    this.log('warn', 'Lesson completion state did not fully stabilize; continuing with current page state.', taskId)
  }

  private async waitForLessonActivation(type: CourseTask['type'], index: number): Promise<void> {
    let deadline = Date.now() + 10000
    while (Date.now() < deadline) {
      this.assertNotStopping()
      if (await this.waitWhileCaptcha()) {
        deadline = Date.now() + 10000
      }
      const lessons = await enumerateLessons(this.probe, type, true).catch(() => [])
      const lesson = lessons.find((candidate) => candidate.index === index)
      if (lesson?.active) {
        await settle(1000)
        return
      }
      await sleep(250)
    }
    await settle(1000)
  }

  private async waitForVideo(): Promise<void> {
    let deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      if (await this.waitWhileCaptcha()) {
        deadline = Date.now() + 30000
      }
      this.assertNotStopping()
      const video = await getVideoState(this.probe).catch(() => undefined)
      if (video?.exists) {
        return
      }
      await sleep(500)
    }
    throw new Error('Timed out waiting for the video element.')
  }

  private async moveMouseOverVideoArea(): Promise<void> {
    const rect = await getVideoAreaRect(this.probe).catch(() => null)
    await moveMouseOverRect(this.contents, rect)
  }

  private async skipQuestions(task: CourseTask): Promise<void> {
    if (task.type === 'hike') {
      return
    }

    const targets = await getQuestionTargets(this.probe, task.type).catch(() => undefined)
    if (!targets?.visible) {
      return
    }

    this.log('info', 'Detected question dialog; attempting to dismiss it.', task.id)
    for (const rect of targets.questionRects) {
      await clickRect(this.contents, rect)
      await settle(150)
      const refreshed = await getQuestionTargets(this.probe, task.type).catch(() => targets)
      for (const answerRect of refreshed.answerRects.slice(0, 2)) {
        await clickRect(this.contents, answerRect)
        await settle(120)
      }
    }

    const closeTarget = await getQuestionTargets(this.probe, task.type).catch(() => targets)
    if (closeTarget.closeRect) {
      await clickRect(this.contents, closeTarget.closeRect)
    } else {
      await pressKey(this.contents, 'Escape')
    }
  }

  private async waitWhileCaptcha(): Promise<boolean> {
    let waited = false
    while (this.captchaVisible && !this.stopping) {
      waited = true
      await sleep(1000)
    }
    this.assertNotStopping()
    return waited
  }

  private assertNotStopping(): void {
    if (this.stopping) {
      throw new Error('Automation stopped.')
    }
  }

  private patchTask(taskId: string, patch: Partial<CourseTask>): void {
    const tasks = this.repository.updateTask(taskId, patch)
    this.events.onTasksChanged(tasks)
  }

  private log(level: LogEntry['level'], message: string, taskId?: string): void {
    this.events.onLog({
      id: randomUUID(),
      level,
      message,
      taskId,
      createdAt: new Date().toISOString()
    })
  }

  private logStudying(taskId: string, lessonName: string): void {
    const key = `${taskId}:${lessonName}`
    if (this.lastStudyingLogKey === key) {
      return
    }

    this.lastStudyingLogKey = key
    this.log('info', `Studying: ${lessonName}`, taskId)
  }

  private emitStatus(state: StatusState, taskId?: string, message?: string): void {
    this.events.onStatus({ state, taskId, message })
  }
}

class StopCurrentTask extends Error {
  constructor() {
    super('Current task stopped by time limit.')
  }
}
