import { Play, Trash2 } from 'lucide-react'
import type { CourseTask } from '../../shared/types'
import { useAppStore } from '../store'

export function TaskList(): JSX.Element {
  const tasks = useAppStore((state) => state.tasks)

  if (tasks.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-line bg-white px-3 py-6 text-center text-sm text-muted">
        No courses added
      </section>
    )
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-normal text-muted">Tasks</h2>
        <span className="text-xs text-muted">{tasks.length}</span>
      </div>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </section>
  )
}

function TaskRow({ task }: { task: CourseTask }): JSX.Element {
  const runTask = useAppStore((state) => state.runTask)
  const removeTask = useAppStore((state) => state.removeTask)
  const active = task.status === 'running' || task.status === 'paused'

  return (
    <article className="rounded-md border border-line bg-white p-3 shadow-panel">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5" title={task.title}>
            {task.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="status-pill">{labelForType(task.type)}</span>
            <span className={`status-pill ${statusClass(task.status)}`}>{task.status}</span>
          </div>
        </div>
        <button
          className="icon-button shrink-0"
          type="button"
          title="Remove"
          disabled={active}
          onClick={() => void removeTask(task.id)}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span className="truncate pr-2">{task.currentLesson || 'Progress'}</span>
          <span>{task.progress}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand" style={{ width: `${progressNumber(task.progress)}%` }} />
        </div>
      </div>

      {task.error ? <p className="mt-2 text-xs text-danger">{task.error}</p> : null}

      <button
        className="command-button mt-3 h-8 w-full justify-center"
        type="button"
        disabled={active}
        onClick={() => void runTask(task.id)}
      >
        <Play size={14} />
        Run
      </button>
    </article>
  )
}

function labelForType(type: CourseTask['type']): string {
  if (type === 'fusioncourseh5') {
    return 'Fusion'
  }
  if (type === 'hike') {
    return 'Hike'
  }
  return 'Legacy'
}

function statusClass(status: CourseTask['status']): string {
  if (status === 'completed') {
    return 'status-pill-done'
  }
  if (status === 'running') {
    return 'status-pill-ready'
  }
  if (status === 'failed') {
    return 'status-pill-error'
  }
  if (status === 'paused') {
    return 'status-pill-paused'
  }
  return ''
}

function progressNumber(progress: string): number {
  const parsed = Number.parseFloat(progress.replace('%', ''))
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
}
