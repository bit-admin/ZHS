export type CourseType = 'legacy' | 'fusioncourseh5' | 'hike'

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface CourseTask {
  id: string
  url: string
  title: string
  type: CourseType
  addedAt: string
  updatedAt: string
  status: TaskStatus
  progress: string
  currentLesson?: string
  error?: string
  lastRunAt?: string
}

export interface Settings {
  limitMaxTime: number
  limitSpeed: number
  soundOff: boolean
  preventSleep: boolean
  language: 'en'
}

export interface BrowserPageState {
  url: string
  title: string
  courseType: CourseType | null
  canGoBack: boolean
  canGoForward: boolean
}

export interface LogEntry {
  id: string
  level: LogLevel
  message: string
  createdAt: string
  taskId?: string
}

export interface AutomationStatus {
  state: 'idle' | 'running' | 'captcha' | 'stopping'
  taskId?: string
  message?: string
}

export interface ElementRect {
  x: number
  y: number
  width: number
  height: number
}

export interface LessonSnapshot {
  index: number
  title: string
  done: boolean
  active: boolean
  progress: string
  rect: ElementRect | null
}

export interface ProgressSnapshot {
  text: string
  percent: number
  finished: boolean
}

export interface VideoSnapshot {
  exists: boolean
  paused: boolean
  duration: number
  currentTime: number
  playbackRate: number
  volume: number
}

export interface QuestionTargets {
  visible: boolean
  questionRects: ElementRect[]
  answerRects: ElementRect[]
  closeRect: ElementRect | null
}

export interface OptimizePageResult {
  removedSelectors: string[]
  clickRects: ElementRect[]
}
