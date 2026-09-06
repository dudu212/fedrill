import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  hasApiKey,
  subscribeApiKey,
} from './api-key'

const STORAGE_KEY = 'fedrill:deepseek-api-key'

describe('api-key · localStorage 存取', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('未存过 · getApiKey 返回 null', () => {
    expect(getApiKey()).toBeNull()
  })

  it('setApiKey · 存后 getApiKey 拿到同值', () => {
    setApiKey('sk-test-1234')
    expect(getApiKey()).toBe('sk-test-1234')
  })

  it('setApiKey · 首尾空格自动 trim 后存', () => {
    setApiKey('  sk-test  ')
    expect(getApiKey()).toBe('sk-test')
  })

  it('setApiKey · 空字符串或纯空格等于清除', () => {
    setApiKey('sk-real')
    setApiKey('   ')
    expect(getApiKey()).toBeNull()
  })

  it('clearApiKey · 移除后 getApiKey 返回 null', () => {
    setApiKey('sk-x')
    clearApiKey()
    expect(getApiKey()).toBeNull()
  })

  it('hasApiKey · 反映是否已存', () => {
    expect(hasApiKey()).toBe(false)
    setApiKey('sk')
    expect(hasApiKey()).toBe(true)
    clearApiKey()
    expect(hasApiKey()).toBe(false)
  })
})

describe('api-key · subscribeApiKey 订阅', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('setApiKey 触发 handler', () => {
    const handler = vi.fn()
    const unsub = subscribeApiKey(handler)
    setApiKey('sk-1')
    expect(handler).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('clearApiKey 触发 handler', () => {
    setApiKey('sk-x')
    const handler = vi.fn()
    const unsub = subscribeApiKey(handler)
    clearApiKey()
    expect(handler).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('unsubscribe 后不再收到通知', () => {
    const handler = vi.fn()
    const unsub = subscribeApiKey(handler)
    unsub()
    setApiKey('sk-1')
    expect(handler).not.toHaveBeenCalled()
  })

  it('跨 tab · 本 key 的 storage 事件触发 handler', () => {
    const handler = vi.fn()
    const unsub = subscribeApiKey(handler)
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'sk-new' }),
    )
    expect(handler).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('跨 tab · 其他 key 的 storage 事件不触发 handler', () => {
    const handler = vi.fn()
    const unsub = subscribeApiKey(handler)
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'other-key', newValue: 'x' }),
    )
    expect(handler).not.toHaveBeenCalled()
    unsub()
  })
})
