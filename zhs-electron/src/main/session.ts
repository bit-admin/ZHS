import { session } from 'electron'
import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PARTITION = 'persist:zhs'
export const DEFAULT_START_URL = 'https://passport.zhihuishu.com/login'
const COOKIE_BACKUP_FILE = 'zhihuishu-cookies.json'
const WINDOWS_CHROME_PLATFORM = 'Windows NT 10.0; Win64; x64'
export const CHROME_CLIENT_HINT_PLATFORM = 'Windows'

export function getWebsiteSession(): Electron.Session {
  const websiteSession = session.fromPartition(PARTITION)
  configureChromeUserAgent(websiteSession)
  return websiteSession
}

export function configureChromeUserAgent(websiteSession: Electron.Session): void {
  const userAgent = buildChromeUserAgent()
  const chromeMajor = process.versions.chrome.split('.')[0]

  websiteSession.setUserAgent(userAgent, 'en-US,en')
  websiteSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'User-Agent': userAgent,
        'sec-ch-ua': `"Chromium";v="${chromeMajor}", "Google Chrome";v="${chromeMajor}", "Not:A-Brand";v="99"`,
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': `"${CHROME_CLIENT_HINT_PLATFORM}"`
      }
    })
  })
}

export async function persistWebsiteSession(websiteSession: Electron.Session): Promise<void> {
  websiteSession.flushStorageData()
  await saveZhihuishuCookies(websiteSession)
  await websiteSession.cookies.flushStore()
}

export async function restoreWebsiteSession(websiteSession: Electron.Session): Promise<void> {
  const cookies = readCookieBackup()
  const now = Date.now() / 1000

  for (const cookie of cookies) {
    if (cookie.expirationDate && cookie.expirationDate < now) {
      continue
    }

    const details = toSetCookieDetails(cookie)
    if (!details) {
      continue
    }

    await websiteSession.cookies.set(details).catch(() => undefined)
  }

  websiteSession.flushStorageData()
  await websiteSession.cookies.flushStore()
}

export function watchWebsiteSessionPersistence(websiteSession: Electron.Session): () => void {
  let timer: NodeJS.Timeout | undefined

  const scheduleFlush = (): void => {
    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      timer = undefined
      void persistWebsiteSession(websiteSession)
    }, 750)
  }

  websiteSession.cookies.on('changed', scheduleFlush)

  return () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    websiteSession.cookies.removeListener('changed', scheduleFlush)
  }
}

export function buildChromeUserAgent(): string {
  const chromeVersion = process.versions.chrome
  return `Mozilla/5.0 (${WINDOWS_CHROME_PLATFORM}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
}

async function saveZhihuishuCookies(websiteSession: Electron.Session): Promise<void> {
  const cookies = await websiteSession.cookies.get({ domain: 'zhihuishu.com' })
  if (cookies.length === 0) {
    return
  }

  const file = cookieBackupPath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(cookies, null, 2)}\n`, 'utf8')
}

function readCookieBackup(): Electron.Cookie[] {
  try {
    const parsed = JSON.parse(readFileSync(cookieBackupPath(), 'utf8')) as Electron.Cookie[]
    return Array.isArray(parsed) ? parsed.filter(isZhihuishuCookie) : []
  } catch {
    return []
  }
}

function toSetCookieDetails(cookie: Electron.Cookie): Electron.CookiesSetDetails | null {
  if (!isZhihuishuCookie(cookie)) {
    return null
  }

  const domain = cookie.domain || ''
  const host = domain.replace(/^\./, '')
  if (!host) {
    return null
  }

  return {
    url: `https://${host}${cookie.path || '/'}`,
    name: cookie.name,
    value: cookie.value,
    domain: cookie.hostOnly ? undefined : cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    expirationDate: cookie.expirationDate,
    sameSite: cookie.sameSite
  }
}

function isZhihuishuCookie(cookie: Electron.Cookie): boolean {
  return Boolean(cookie.name && cookie.domain?.replace(/^\./, '').endsWith('zhihuishu.com'))
}

function cookieBackupPath(): string {
  return join(app.getPath('userData'), COOKIE_BACKUP_FILE)
}
