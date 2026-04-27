import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Code2, Play, RefreshCw, Settings, Square } from 'lucide-react'
import { AddCourseButton } from './components/AddCourseButton'
import { CaptchaBanner } from './components/CaptchaBanner'
import { LogPanel } from './components/LogPanel'
import { SettingsDrawer } from './components/SettingsDrawer'
import { TaskList } from './components/TaskList'
import { useAppStore } from './store'

export function App(): JSX.Element {
  const {
    init,
    initialized,
    pageState,
    automation,
    captchaVisible,
    navigate,
    goBack,
    goForward,
    reload,
    openWebsiteDevTools,
    runTask,
    stopRun,
    error,
    clearError
  } = useAppStore()
  const [urlDraft, setUrlDraft] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    setUrlDraft(pageState.url)
  }, [pageState.url])

  const courseTag = useMemo(() => {
    if (!pageState.courseType) {
      return 'No course'
    }
    return pageState.courseType === 'fusioncourseh5'
      ? 'Fusion'
      : pageState.courseType === 'hike'
        ? 'Hike'
        : 'Legacy'
  }, [pageState.courseType])

  const submitNavigation = (event: FormEvent): void => {
    event.preventDefault()
    void navigate(urlDraft)
  }

  if (!initialized) {
    return <div className="flex h-screen w-[360px] items-center justify-center text-sm text-muted">Loading</div>
  }

  return (
    <main className="relative h-screen w-[360px] overflow-hidden border-r border-line bg-panel text-ink">
      <section className="flex h-full flex-col">
        <header className="border-b border-line bg-white px-4 pb-3 pt-4 shadow-panel">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[17px] font-semibold tracking-normal">ZHS Autovisor</h1>
              <p className="mt-0.5 max-w-[250px] truncate text-xs text-muted" title={pageState.title}>
                {pageState.title || 'Zhihuishu'}
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              title="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={17} />
            </button>
          </div>

          <form className="mt-3 flex items-center gap-1" onSubmit={submitNavigation}>
            <button
              className="icon-button"
              type="button"
              title="Back"
              disabled={!pageState.canGoBack}
              onClick={() => void goBack()}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="icon-button"
              type="button"
              title="Forward"
              disabled={!pageState.canGoForward}
              onClick={() => void goForward()}
            >
              <ChevronRight size={17} />
            </button>
            <button className="icon-button" type="button" title="Reload" onClick={() => void reload()}>
              <RefreshCw size={15} />
            </button>
            <input
              className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100"
              value={urlDraft}
              spellCheck={false}
              onFocus={clearError}
              onChange={(event) => setUrlDraft(event.target.value)}
            />
          </form>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className={`status-pill ${pageState.courseType ? 'status-pill-ready' : ''}`}>{courseTag}</span>
            <div className="flex items-center gap-1">
              <button
                className="icon-button"
                type="button"
                title="Website DevTools"
                onClick={() => void openWebsiteDevTools()}
              >
                <Code2 size={15} />
              </button>
              {automation.state === 'running' || automation.state === 'captcha' ? (
                <button className="command-button command-danger" type="button" onClick={() => void stopRun()}>
                  <Square size={14} />
                  Stop
                </button>
              ) : (
                <button className="command-button" type="button" onClick={() => void runTask()}>
                  <Play size={14} />
                  Run Pending
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          <CaptchaBanner visible={captchaVisible} />
          {error ? <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-danger">{error}</div> : null}
          <AddCourseButton />
          <TaskList />
          <LogPanel />
        </div>

        <footer className="border-t border-line bg-white px-4 py-2 text-xs text-muted">
          {automation.message || 'Idle'}
        </footer>
      </section>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  )
}
