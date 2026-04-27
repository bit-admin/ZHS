import { ShieldAlert } from 'lucide-react'

interface Props {
  visible: boolean
}

export function CaptchaBanner({ visible }: Props): JSX.Element | null {
  if (!visible) {
    return null
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-danger">
      <ShieldAlert size={16} />
      Please complete the captcha in the browser.
    </div>
  )
}
