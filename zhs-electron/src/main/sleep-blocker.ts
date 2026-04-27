import { powerSaveBlocker } from 'electron'
import type { Settings } from '../shared/types'

export class SleepBlocker {
  private blockerId: number | null = null

  apply(settings: Settings): void {
    if (settings.preventSleep) {
      this.start()
    } else {
      this.stop('disabled by settings')
    }
  }

  start(): void {
    if (this.blockerId !== null && powerSaveBlocker.isStarted(this.blockerId)) {
      return
    }

    this.blockerId = powerSaveBlocker.start('prevent-display-sleep')
    if (powerSaveBlocker.isStarted(this.blockerId)) {
      console.info(`[sleep-blocker] enabled id=${this.blockerId} mode=prevent-display-sleep`)
    } else {
      console.warn(`[sleep-blocker] failed to start id=${this.blockerId}`)
      this.blockerId = null
    }
  }

  stop(reason = 'stopped'): void {
    if (this.blockerId === null) {
      return
    }

    const id = this.blockerId
    if (powerSaveBlocker.isStarted(id)) {
      powerSaveBlocker.stop(id)
      console.info(`[sleep-blocker] ${reason} id=${id}`)
    }
    this.blockerId = null
  }
}
