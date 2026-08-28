import { describe, it, expect, beforeEach } from 'vitest'
import {
  LocalStorageSessionRepo,
  type SessionMessage,
} from './session-repo'

/**
 * 每条测试前清空 happy-dom 提供的 localStorage，防互相污染。
 */
beforeEach(() => {
  window.localStorage.clear()
})

describe('LocalStorageSessionRepo', () => {
  describe('基础往返', () => {
    it('新会话读取返回 null', async () => {
      const repo = new LocalStorageSessionRepo()
      const snap = await repo.get('unknown-problem')
      expect(snap).toBeNull()
    })

    it('save({code}) 后 get 能取到 code，其余字段为默认值', async () => {
      const repo = new LocalStorageSessionRepo()
      await repo.save('deep-clone', { code: 'function myDeepClone(){}' })
      const snap = await repo.get('deep-clone')
      expect(snap).not.toBeNull()
      expect(snap!.problemId).toBe('deep-clone')
      expect(snap!.code).toBe('function myDeepClone(){}')
      expect(snap!.messages).toEqual([])
      expect(snap!.currentRound).toBe(0)
      expect(snap!.hintsUsed).toBe(0)
      expect(snap!.testedCodeSnapshot).toBeNull()
      expect(snap!.lastTestResults).toBeNull()
    })

    it('partial save 多次合并，未指定字段保持不变', async () => {
      const repo = new LocalStorageSessionRepo()
      await repo.save('flat', { code: 'v1' })
      await repo.save('flat', { currentRound: 1 })
      const snap = await repo.get('flat')
      expect(snap!.code).toBe('v1') // 仍然保留
      expect(snap!.currentRound).toBe(1) // 新值
    })

    it('save 会刷新 updatedAt', async () => {
      const repo = new LocalStorageSessionRepo()
      await repo.save('flat', { code: 'v1' })
      const first = (await repo.get('flat'))!.updatedAt
      // 手动等一点，避免同一毫秒
      await new Promise((r) => setTimeout(r, 5))
      await repo.save('flat', { code: 'v2' })
      const second = (await repo.get('flat'))!.updatedAt
      expect(second).toBeGreaterThan(first)
    })

    it('messages 数组存取无损（含 toolCalls）', async () => {
      const repo = new LocalStorageSessionRepo()
      const msgs: SessionMessage[] = [
        { role: 'user', content: '你看这有什么问题', timestamp: 1000 },
        {
          role: 'assistant',
          content: '让我先跑测试看看',
          toolCalls: [
            { id: 'call_1', name: 'run_tests', args: {} },
          ],
          timestamp: 2000,
        },
        {
          role: 'tool',
          content: '{"passed":0,"total":4}',
          toolCallId: 'call_1',
          timestamp: 3000,
        },
      ]
      await repo.save('my-call', { messages: msgs })
      const snap = await repo.get('my-call')
      expect(snap!.messages).toEqual(msgs)
    })
  })

  describe('老 key 自动迁移（保护用户数据）', () => {
    it('读取时如果新 key 空、老 key 有值 → 自动搬进新格式', async () => {
      // 预置一个 M1 时代的老 key
      window.localStorage.setItem(
        'fedrill:code:deep-clone',
        'function myDeepClone(){}',
      )

      const repo = new LocalStorageSessionRepo()
      const snap = await repo.get('deep-clone')

      expect(snap).not.toBeNull()
      expect(snap!.code).toBe('function myDeepClone(){}')
    })

    it('迁移后老 key 被清除，防止下次 get 又被迁移一次', async () => {
      window.localStorage.setItem('fedrill:code:flat', 'legacy code')

      const repo = new LocalStorageSessionRepo()
      await repo.get('flat')

      // 老 key 应该已经被清除
      expect(window.localStorage.getItem('fedrill:code:flat')).toBeNull()
      // 新 key 应该已经存在
      expect(
        window.localStorage.getItem('fedrill:session:v1:flat'),
      ).not.toBeNull()
    })

    it('迁移只发生一次：第二次 get 走正常路径', async () => {
      window.localStorage.setItem('fedrill:code:my-call', 'v1')

      const repo = new LocalStorageSessionRepo()
      const first = await repo.get('my-call')
      expect(first!.code).toBe('v1')

      // 手动模拟：新 key 存在，老 key 不复活
      await repo.save('my-call', { code: 'v2' })

      const second = await repo.get('my-call')
      expect(second!.code).toBe('v2') // 是 save 后的值，不是被迁移覆盖
      expect(window.localStorage.getItem('fedrill:code:my-call')).toBeNull()
    })

    it('损坏的 JSON 不会崩，退回迁移路径或返回 null', async () => {
      window.localStorage.setItem('fedrill:session:v1:promise-all', 'not-json{')
      const repo = new LocalStorageSessionRepo()
      const snap = await repo.get('promise-all')
      // 没有老 key 也没有可解析的新 key → null
      expect(snap).toBeNull()
    })
  })

  describe('reset', () => {
    it('reset 后 get 返回 null', async () => {
      const repo = new LocalStorageSessionRepo()
      await repo.save('flat', { code: 'v1' })
      await repo.reset('flat')
      expect(await repo.get('flat')).toBeNull()
    })

    it('reset 同时清除新老两个 key（避免老 key 复活）', async () => {
      window.localStorage.setItem('fedrill:code:flat', 'legacy')
      const repo = new LocalStorageSessionRepo()
      await repo.save('flat', { code: 'new' })

      await repo.reset('flat')

      expect(window.localStorage.getItem('fedrill:session:v1:flat')).toBeNull()
      expect(window.localStorage.getItem('fedrill:code:flat')).toBeNull()
    })
  })
})
