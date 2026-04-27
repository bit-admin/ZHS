import { ipcRenderer, webFrame } from 'electron'
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
import { buildStealthScript } from './stealth'

interface ProbeRequest {
  id: string
  kind: string
  payload?: Record<string, unknown>
}

let watchdogSettings: Settings | null = null
let captchaVisible = false

void webFrame.executeJavaScript(
  buildStealthScript({
    chromeVersion: process.versions.chrome || '124.0.0.0',
    platform: 'Windows',
    languages: ['en-US', 'en']
  }),
  false
)

ipcRenderer.on('zhs:watchdog-config', (_event, settings: Settings) => {
  watchdogSettings = normalizeSettings(settings)
  applyVideoSettings()
})

ipcRenderer.on('zhs:watchdog-stop', () => {
  watchdogSettings = null
})

ipcRenderer.on('zhs:probe', async (_event, request: ProbeRequest) => {
  try {
    const value = await handleProbe(request.kind, request.payload || {})
    ipcRenderer.send('zhs:probe-result', { id: request.id, ok: true, value })
  } catch (error) {
    ipcRenderer.send('zhs:probe-result', {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
})

window.addEventListener('DOMContentLoaded', () => {
  startCaptchaObserver()
  applyVideoSettings()
})

setInterval(() => {
  checkCaptcha()
  applyVideoSettings()
}, 2000)

async function handleProbe(kind: string, payload: Record<string, unknown>): Promise<unknown> {
  const type = payload.type as CourseType | undefined
  switch (kind) {
    case 'courseTitle':
      return getCourseTitle(type)
    case 'optimizePage':
      return optimizePage(type)
    case 'enumerateLessons':
      return enumerateLessons(type, Boolean(payload.includeAll))
    case 'lessonRect':
      return getLessonRect(type, Number(payload.index))
    case 'lessonName':
      return getLessonName(type)
    case 'progress':
      return getProgress(type)
    case 'videoAreaRect':
      return getVideoAreaRect()
    case 'videoState':
      return getVideoState()
    case 'resetVideoTime':
      return resetVideoTime()
    case 'questionTargets':
      return getQuestionTargets(type)
    default:
      throw new Error(`Unknown probe: ${kind}`)
  }
}

function normalizeSettings(settings: Settings): Settings {
  return {
    limitMaxTime: Number.isFinite(settings.limitMaxTime) ? Math.max(0, settings.limitMaxTime) : 30,
    limitSpeed: Number.isFinite(settings.limitSpeed) ? Math.max(0.5, Math.min(1.8, settings.limitSpeed)) : 1,
    soundOff: Boolean(settings.soundOff),
    preventSleep: settings.preventSleep !== false,
    language: 'en'
  }
}

function getCourseTitle(type?: CourseType): string {
  const selectors =
    type === 'hike'
      ? ['.course-name', '#sourceTit', '.source-name', 'h1']
      : ['.source-name', '.course-name', '#sourceTit', 'h1']

  for (const selector of selectors) {
    const text = textOf(document.querySelector(selector))
    if (text) {
      return text
    }
  }

  return document.title || location.href
}

function optimizePage(type?: CourseType): OptimizePageResult {
  const removedSelectors: string[] = []
  const clickRects: ElementRect[] = []

  if (type !== 'hike') {
    const popupClose = rectOf(document.querySelector('.iconfont.iconguanbi'))
    if (popupClose) {
      clickRects.push(popupClose)
    }
  }

  if (type !== 'fusioncourseh5' && type !== 'hike') {
    const hour = new Date().getHours()
    if (hour >= 18 || hour < 7) {
      const nightMode = rectOf(document.querySelector('.Patternbtn-div'))
      if (nightMode) {
        clickRects.push(nightMode)
      }
    }

    for (const selector of ['.exploreTip', '.ai-helper-Index2', '.aiMsg.once']) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        element.remove()
        removedSelectors.push(selector)
      }
    }
  }

  return { removedSelectors, clickRects }
}

function enumerateLessons(type?: CourseType, includeAll = false): LessonSnapshot[] {
  const selector = lessonSelector(type)
  return Array.from(document.querySelectorAll<HTMLElement>(selector))
    .map((element, index) => {
      const done = isLessonDone(element, type)
      return {
        index,
        title: lessonTitle(element),
        done,
        active: isLessonActive(element, type),
        progress: lessonProgress(element, type),
        rect: rectOf(element)
      }
    })
    .filter((lesson) => includeAll || !lesson.done)
}

function getLessonRect(type?: CourseType, index = 0): ElementRect | null {
  const element = document.querySelectorAll<HTMLElement>(lessonSelector(type))[index]
  return rectOf(element || null)
}

function getLessonName(type?: CourseType): string {
  if (type === 'hike') {
    const titledSpan = Array.from(document.querySelectorAll<HTMLElement>('span')).find((element) =>
      element.getAttribute('title')
    )
    return titledSpan?.getAttribute('title') || textOf(document.querySelector('.file-item.active')) || document.title
  }

  const lessonOrder = document.querySelector<HTMLElement>('#lessonOrder')
  return lessonOrder?.getAttribute('title') || textOf(document.querySelector('.current_play')) || document.title
}

function getProgress(type?: CourseType): ProgressSnapshot {
  const active = document.querySelector<HTMLElement>(type === 'hike' ? '.file-item.active' : '.current_play')
  if (!active) {
    return { text: '0%', percent: 0, finished: false }
  }

  const progressElement = active.querySelector<HTMLElement>(type === 'hike' ? '.rate' : '.progress-num')
  const progressText = textOf(progressElement)
  if (progressText) {
    const percent = parsePercent(progressText)
    return { text: progressText, percent, finished: percent >= 100 }
  }

  const finished =
    type === 'hike' ? Boolean(active.querySelector('.icon-finish')) : Boolean(active.querySelector('.time_icofinish'))
  return {
    text: finished ? '100%' : '0%',
    percent: finished ? 100 : 0,
    finished
  }
}

function getVideoAreaRect(): ElementRect | null {
  return rectOf(document.querySelector('.videoArea'))
}

function getVideoState(): VideoSnapshot {
  const video = document.querySelector<HTMLVideoElement>('video')
  if (!video) {
    return {
      exists: false,
      paused: true,
      duration: 0,
      currentTime: 0,
      playbackRate: 1,
      volume: 1
    }
  }

  return {
    exists: true,
    paused: video.paused,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    playbackRate: video.playbackRate,
    volume: video.volume
  }
}

function resetVideoTime(): boolean {
  const video = document.querySelector<HTMLVideoElement>('video')
  if (!video) {
    return false
  }
  video.currentTime = 0
  return true
}

function getQuestionTargets(type?: CourseType): QuestionTargets {
  if (type === 'hike') {
    return { visible: false, questionRects: [], answerRects: [], closeRect: null }
  }

  const topicTitle = document.querySelector<HTMLElement>('.topic-title')
  const questionDialog =
    topicTitle?.closest<HTMLElement>('.el-dialog, .el-message-box') ||
    document.querySelector<HTMLElement>('.el-scrollbar__view .number')?.closest<HTMLElement>('.el-dialog, .el-message-box') ||
    null
  const root =
    questionDialog?.querySelector<HTMLElement>('.el-scrollbar__view') ||
    document.querySelector<HTMLElement>('.el-scrollbar__view .number')?.closest<HTMLElement>('.el-scrollbar__view') ||
    null
  const questionRects = root
    ? Array.from(root.querySelectorAll<HTMLElement>('.number')).map(rectOf).filter(isRect)
    : []

  const answered = Boolean(document.querySelector('.answer'))
  const answerScope = questionDialog || document
  const answerRects = answered
    ? []
    : Array.from(answerScope.querySelectorAll<HTMLElement>('.topic-item')).map(rectOf).filter(isRect).slice(0, 2)

  const closeRect =
    rectOf(questionDialog?.querySelector('.el-message-box__headerbtn') || null) ||
    rectOf(questionDialog?.querySelector('.el-dialog__headerbtn') || null) ||
    null

  return {
    visible: Boolean(topicTitle || questionRects.length || answerRects.length),
    questionRects,
    answerRects,
    closeRect
  }
}

function applyVideoSettings(): void {
  if (!watchdogSettings) {
    return
  }

  const video = document.querySelector<HTMLVideoElement>('video')
  if (!video) {
    return
  }

  if (watchdogSettings.soundOff && video.volume !== 0) {
    video.volume = 0
    document.querySelector('.volumeBox')?.classList.add('volumeNone')
  }

  if (video.playbackRate !== watchdogSettings.limitSpeed) {
    video.playbackRate = watchdogSettings.limitSpeed
    const speedLabel = document.querySelector<HTMLElement>('.speedBox span')
    if (speedLabel) {
      speedLabel.innerText = `X ${watchdogSettings.limitSpeed}`
    }
  }

  if (video.paused) {
    void video.play().catch(() => undefined)
  }
}

function startCaptchaObserver(): void {
  const root = document.documentElement || document.body
  if (!root) {
    return
  }

  const observer = new MutationObserver(checkCaptcha)
  observer.observe(root, { attributes: true, childList: true, subtree: true })
  checkCaptcha()
}

function checkCaptcha(): void {
  const visible = Array.from(document.querySelectorAll<HTMLElement>('.yidun_modal__title')).some(isElementVisible)
  if (visible === captchaVisible) {
    return
  }

  captchaVisible = visible
  ipcRenderer.send('zhs:captcha-state', { visible })
}

function isElementVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
    return false
  }

  let node: HTMLElement | null = element
  while (node) {
    const style = window.getComputedStyle(node)
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      Number(style.opacity) === 0
    ) {
      return false
    }
    node = node.parentElement
  }

  return element.getClientRects().length > 0
}

function lessonSelector(type?: CourseType): string {
  return type === 'hike' ? '.file-item' : '.clearfix.video'
}

function isLessonDone(element: Element, type?: CourseType): boolean {
  if (type === 'hike') {
    return Boolean(element.querySelector('.icon-finish'))
  }
  if (type === 'fusioncourseh5') {
    return textOf(element.querySelector('.progress-num')) === '100%'
  }
  return Boolean(element.querySelector('.time_icofinish'))
}

function isLessonActive(element: Element, type?: CourseType): boolean {
  return element.classList.contains(type === 'hike' ? 'active' : 'current_play')
}

function lessonProgress(element: Element, type?: CourseType): string {
  if (type === 'hike') {
    return textOf(element.querySelector('.rate')) || (isLessonDone(element, type) ? '100%' : '0%')
  }
  return textOf(element.querySelector('.progress-num')) || (isLessonDone(element, type) ? '100%' : '0%')
}

function lessonTitle(element: HTMLElement): string {
  return element.getAttribute('title') || textOf(element) || `Lesson ${element.dataset.index || ''}`.trim()
}

function textOf(element: Element | null): string {
  return (element?.textContent || '').replace(/\s+/g, ' ').trim()
}

function rectOf(element: Element | null): ElementRect | null {
  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return null
  }

  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  }
}

function parsePercent(value: string): number {
  const parsed = Number.parseFloat(value.replace('%', '').trim())
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
}

function isRect(rect: ElementRect | null): rect is ElementRect {
  return Boolean(rect)
}
