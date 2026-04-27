import { X } from 'lucide-react'
import { useAppStore } from '../store'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDrawer({ open, onClose }: Props): JSX.Element | null {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)

  if (!open) {
    return null
  }

  return (
    <aside className="absolute inset-0 z-10 flex flex-col bg-white">
      <header className="flex items-center justify-between border-b border-line px-4 py-4">
        <h2 className="text-sm font-semibold">Settings</h2>
        <button className="icon-button" type="button" title="Close" onClick={onClose}>
          <X size={17} />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <label className="block">
          <span className="field-label">Limit Max Time</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="field-input"
              type="number"
              min={0}
              step={1}
              value={settings.limitMaxTime}
              onChange={(event) => void updateSettings({ limitMaxTime: Number(event.target.value) })}
            />
            <span className="text-xs text-muted">minutes</span>
          </div>
        </label>

        <label className="block">
          <span className="field-label">Limit Speed</span>
          <div className="mt-2 flex items-center gap-3">
            <input
              className="w-full accent-brand"
              type="range"
              min={0.5}
              max={1.8}
              step={0.1}
              value={settings.limitSpeed}
              onChange={(event) => void updateSettings({ limitSpeed: Number(event.target.value) })}
            />
            <span className="w-10 text-right text-xs font-semibold text-ink">{settings.limitSpeed.toFixed(1)}x</span>
          </div>
        </label>

        <label className="flex items-center justify-between rounded-md border border-line px-3 py-3">
          <span className="field-label">Sound Off</span>
          <input
            className="h-4 w-4 accent-brand"
            type="checkbox"
            checked={settings.soundOff}
            onChange={(event) => void updateSettings({ soundOff: event.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between rounded-md border border-line px-3 py-3">
          <span className="field-label">Block System Sleep</span>
          <input
            className="h-4 w-4 accent-brand"
            type="checkbox"
            checked={settings.preventSleep}
            onChange={(event) => void updateSettings({ preventSleep: event.target.checked })}
          />
        </label>

        <label className="block">
          <span className="field-label">Language</span>
          <select className="field-input mt-1" value={settings.language} disabled>
            <option value="en">English</option>
          </select>
        </label>
      </div>
    </aside>
  )
}
