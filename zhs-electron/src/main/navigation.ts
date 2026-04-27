export async function loadUrl(contents: Electron.WebContents, url: string): Promise<void> {
  try {
    await contents.loadURL(url)
  } catch (error) {
    if (!isNavigationAbort(error)) {
      throw error
    }
  }
}

export function isNavigationAbort(error: unknown): boolean {
  if (!error) {
    return false
  }

  const message = error instanceof Error ? error.message : String(error)
  return message.includes('ERR_ABORTED') || message.includes('(-3)')
}

export function isIgnorableLoadFailure(errorCode: number, isMainFrame = true): boolean {
  return errorCode === -3 || !isMainFrame
}
