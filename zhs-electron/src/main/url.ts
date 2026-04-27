import type { CourseType } from '../shared/types'

const UPSTREAM_URL_RULE = /https:\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/

const COURSE_PATH_HINTS = [
  'study',
  'video',
  'learn',
  'course',
  'shareCourse',
  'onlineWeb',
  'studentstudy',
  'learning'
]

export function classifyCourseUrl(input: string): CourseType | null {
  if (!UPSTREAM_URL_RULE.test(input)) {
    return null
  }

  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  const full = input.toLowerCase()

  if (host === 'hike.zhihuishu.com' || host.endsWith('.hike.zhihuishu.com')) {
    return 'hike'
  }

  if (full.includes('fusioncourseh5')) {
    return 'fusioncourseh5'
  }

  if (!host.endsWith('zhihuishu.com') || host.startsWith('passport.')) {
    return null
  }

  return COURSE_PATH_HINTS.some((hint) => full.includes(hint.toLowerCase())) ? 'legacy' : null
}

export function normalizeNavigationUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    return 'https://passport.zhihuishu.com/login'
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}
