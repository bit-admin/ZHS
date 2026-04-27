import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#f7f8fa',
        ink: '#17202a',
        muted: '#667085',
        line: '#d7dce3',
        brand: '#2563eb',
        success: '#0f8a5f',
        danger: '#c2410c'
      },
      boxShadow: {
        panel: '0 1px 2px rgba(16, 24, 40, 0.06)'
      }
    }
  },
  plugins: []
} satisfies Config
