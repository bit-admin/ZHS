import { BrowserWindow, WebContentsView } from 'electron'
import { join } from 'node:path'
import { loadUrl } from './navigation'
import { buildChromeUserAgent } from './session'

export const SIDEBAR_WIDTH = 360
const MIN_BROWSER_WIDTH = 500

export interface AppViews {
  window: BrowserWindow
  websiteView: WebContentsView
  resize: () => void
}

export async function createAppViews(websiteSession: Electron.Session): Promise<AppViews> {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: SIDEBAR_WIDTH + MIN_BROWSER_WIDTH,
    minHeight: 620,
    title: 'ZHS Autovisor',
    backgroundColor: '#f7f8fa',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/renderer.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: false,
      backgroundThrottling: false
    }
  })

  const websiteView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/zhs.js'),
      session: websiteSession,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      devTools: true,
      backgroundThrottling: false
    }
  })

  websiteView.webContents.setUserAgent(buildChromeUserAgent())
  window.contentView.addChildView(websiteView)

  const resize = (): void => {
    const [width, height] = window.getContentSize()
    websiteView.setBounds({
      x: SIDEBAR_WIDTH,
      y: 0,
      width: Math.max(MIN_BROWSER_WIDTH, width - SIDEBAR_WIDTH),
      height
    })
  }

  window.on('resize', resize)
  window.on('maximize', resize)
  window.on('unmaximize', resize)
  window.on('ready-to-show', () => {
    resize()
    window.show()
  })

  websiteView.webContents.setWindowOpenHandler(({ url }) => {
    void loadUrl(websiteView.webContents, url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  resize()

  return { window, websiteView, resize }
}
