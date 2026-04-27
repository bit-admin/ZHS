import { useAppStore } from '../store'

export function LogPanel(): JSX.Element {
  const logs = useAppStore((state) => state.logs)

  return (
    <section className="flex min-h-[260px] flex-1 flex-col rounded-md border border-line bg-white shadow-panel">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-normal text-muted">Log</h2>
        <span className="text-xs text-muted">{logs.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No log entries</p>
        ) : (
          <ol className="space-y-2">
            {logs.map((entry) => (
              <li key={entry.id} className="text-xs leading-5">
                <span className={levelClass(entry.level)}>{entry.level}</span>
                <span className="ml-2 text-muted">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                <p className="mt-0.5 text-ink">{entry.message}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function levelClass(level: string): string {
  if (level === 'error') {
    return 'font-semibold text-danger'
  }
  if (level === 'warn') {
    return 'font-semibold text-amber-700'
  }
  if (level === 'debug') {
    return 'font-semibold text-muted'
  }
  return 'font-semibold text-brand'
}
