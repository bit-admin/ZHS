import { Plus } from 'lucide-react'
import { useAppStore } from '../store'

export function AddCourseButton(): JSX.Element {
  const pageState = useAppStore((state) => state.pageState)
  const addCurrentCourse = useAppStore((state) => state.addCurrentCourse)

  return (
    <button
      className="command-button h-10 w-full justify-center"
      type="button"
      disabled={!pageState.courseType}
      onClick={() => void addCurrentCourse()}
    >
      <Plus size={16} />
      Add Course
    </button>
  )
}
