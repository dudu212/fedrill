import { useEffect, useState } from 'react'

/**
 * 明暗主题的客户端状态层。与 api-key.ts 同构的订阅模式,不引状态库。
 *
 * 主题载体:documentElement 的 `.dark` class + localStorage(`fedrill:theme`)。
 * - getTheme 读 class(SSR 安全,无 class 时视为 light)
 * - setTheme 写 class + localStorage + 广播,让 subscribe 的组件同步更新
 * - subscribeTheme 让 Monaco 等硬编码"主题"的组件跟随切换
 */

const STORAGE_KEY = 'fedrill:theme'
const CHANGE_EVENT = 'fedrill-theme-change'

export type Theme = 'dark' | 'light'

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage 不可用(隐私模式等)时静默降级,仅本次会话内生效
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** 切换并返回新主题。 */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

/**
 * 订阅主题变化。返回 unsubscribe 函数。
 * 同时监听跨 tab 的 localStorage 变化(用户在另一个 tab 切了主题)。
 */
export function subscribeTheme(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, handler)
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) handler()
  }
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler)
    window.removeEventListener('storage', storageHandler)
  }
}

/** React hook:返回当前主题,并在切换时触发重渲染。 */
export function useTheme(): Theme {
  const [theme, setThemeState] = useState<Theme>('light')
  useEffect(() => {
    setThemeState(getTheme())
    return subscribeTheme(() => setThemeState(getTheme()))
  }, [])
  return theme
}
