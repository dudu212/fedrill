/**
 * BYOK(Bring Your Own Key)· 访客自带 API Key 的客户端存储层。
 *
 * 存 localStorage,只在本浏览器内活,不会上传到任何第三方(除了 DeepSeek 官方 API,
 * 通过我们服务端的 SSE 代理转发时才发送)。
 *
 * 设计原则:
 * - 简单的 get/set/clear/subscribe · 不引入 Zustand 之类的状态库
 * - subscribe 让 UI(如设置按钮的"已配置/未配置"徽章)能响应式更新
 * - SSR-safe:typeof window 保护,静默降级
 */

const STORAGE_KEY = 'fedrill:deepseek-api-key'
const CHANGE_EVENT = 'fedrill-api-key-change'

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return
  const trimmed = key.trim()
  if (trimmed) {
    window.localStorage.setItem(STORAGE_KEY, trimmed)
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
  // 让页面里所有 subscribe 的组件同步更新
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function clearApiKey(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

/**
 * 订阅 API key 的变化。返回一个 unsubscribe 函数。
 * 用法:useEffect(() => subscribeApiKey(() => setState(...)), [])
 */
export function subscribeApiKey(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, handler)
  // 也监听跨 tab 的 localStorage 变化(用户在另一个 tab 改了 key)
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) handler()
  }
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler)
    window.removeEventListener('storage', storageHandler)
  }
}
