'use client'

import { useEffect, useState } from 'react'
import { getTheme, toggleTheme, type Theme } from '@/lib/settings/theme'

/**
 * 明暗主题切换按钮。挂在根布局里,固定右下角,全站可见。
 * 深色时显示太阳(点击切浅色),浅色时显示月亮(点击切深色)。
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(getTheme())
  }, [])

  const label = theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      aria-label={label}
      title={label}
      className="fixed top-4 right-4 z-40 flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-surface text-muted shadow-sm transition-colors hover:border-hairline-strong hover:text-fg"
    >
      {theme === 'dark' ? (
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
