import type { ElementRect } from '../shared/types'

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function midpoint(rect: ElementRect): { x: number; y: number } {
  const jitterX = Math.max(-4, Math.min(4, (Math.random() - 0.5) * Math.min(rect.width, 16)))
  const jitterY = Math.max(-4, Math.min(4, (Math.random() - 0.5) * Math.min(rect.height, 16)))
  return {
    x: Math.round(rect.x + rect.width / 2 + jitterX),
    y: Math.round(rect.y + rect.height / 2 + jitterY)
  }
}

export async function clickRect(contents: Electron.WebContents, rect: ElementRect | null): Promise<boolean> {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return false
  }

  const { x, y } = midpoint(rect)
  contents.sendInputEvent({ type: 'mouseMove', x, y, movementX: 0, movementY: 0 })
  await wait(60 + Math.random() * 90)
  contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x, y })
  await wait(40 + Math.random() * 60)
  contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x, y })
  await wait(100 + Math.random() * 140)
  return true
}

export async function moveMouseOverRect(contents: Electron.WebContents, rect: ElementRect | null): Promise<boolean> {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return false
  }

  const { x, y } = midpoint(rect)
  contents.sendInputEvent({ type: 'mouseMove', x, y, movementX: 0, movementY: 0 })
  await wait(40 + Math.random() * 80)
  return true
}

export async function pressKey(contents: Electron.WebContents, keyCode: string): Promise<void> {
  contents.sendInputEvent({ type: 'keyDown', keyCode })
  await wait(30)
  contents.sendInputEvent({ type: 'keyUp', keyCode })
}

export async function settle(ms = 500): Promise<void> {
  await wait(ms)
}
