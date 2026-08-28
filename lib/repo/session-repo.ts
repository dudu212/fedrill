import type { Round } from '@/lib/types/problem'
import type { SandboxRunResult } from '@/lib/sandbox/types'

/**
 * 会话内的一条消息。
 *
 * 覆盖 M1 的纯文本聊天 + M2 起的 tool_use / tool_result 协议。
 * 保持与 Anthropic/OpenAI tool 协议对齐：
 *   - assistant 消息：可能带 `toolCalls`（本轮 LLM 决定要调的 tool）
 *   - role='tool' 消息：`toolCallId` 引用上文 assistant.toolCalls[i].id，`content` 是 tool 结果的 stringify
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  /** Assistant 触发的 tool_call（M2 起使用） */
  toolCalls?: SessionToolCall[]
  /** role='tool' 时必填：本条结果对应的 tool_call.id */
  toolCallId?: string
  /** epoch ms · 由 repo 层在 append 时兜底填充 */
  timestamp: number
}

export interface SessionToolCall {
  id: string
  name: string
  /** JSON 反序列化后的对象。落存也直接存对象（不像 provider 协议是 JSON 字符串） */
  args: unknown
}

/**
 * 单题会话快照。以 problemId 为主键，跨刷新持久化。
 */
export interface SessionSnapshot {
  problemId: string
  /** 当前 Monaco 里的代码字节 */
  code: string
  /** 完整对话历史（含 tool_call / tool_result） */
  messages: SessionMessage[]
  /** 客户端派生的 Round 号；M2 起由 Agent Loop 主动写 */
  currentRound: Round
  /** M2 起：AI 主动给出的提示次数累计 */
  hintsUsed: number
  /** 上次跑测试那一刻的代码字节快照。用于陈旧检测：与 code 不一致 → 测试结果已陈旧 */
  testedCodeSnapshot: string | null
  /** 最近一次测试结果（供 AI 上下文注入） */
  lastTestResults: SandboxRunResult | null
  /** epoch ms */
  createdAt: number
  /** epoch ms · save 时自动刷新 */
  updatedAt: number
}

/**
 * 部分更新载荷。禁止直接改 `problemId / createdAt / updatedAt`——
 * problemId 是主键（用调用参数即可），后两者由 repo 自管。
 */
export type SessionPatch = Partial<
  Omit<SessionSnapshot, 'problemId' | 'createdAt' | 'updatedAt'>
>

/**
 * 会话仓库接口。稳定 API，实现层可替换（M1–M3 用 LocalStorage，M4 换 Supabase 不改调用方）。
 *
 * 所有方法均 async——LocalStorage 实现下用 `Promise.resolve` 包裹本地读写，
 * Supabase 实现下才是真正的网络 I/O。上层 await 一次就好。
 */
export interface SessionRepo {
  /** 读取该 problemId 的会话；不存在返回 null */
  get(problemId: string): Promise<SessionSnapshot | null>

  /** 部分更新；若不存在则创建。updatedAt 自动刷新 */
  save(problemId: string, patch: SessionPatch): Promise<void>

  /** 清空该 problemId 的会话（不影响题目静态数据） */
  reset(problemId: string): Promise<void>
}

// ─────────────────────────────────────────────────────────────
// LocalStorage 实现（M1–M3）
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'fedrill:session:v1:'

/** 老版本单独存代码的 key，读取时透明迁移到新格式 */
const LEGACY_CODE_KEY_PREFIX = 'fedrill:code:'

function storageKey(problemId: string): string {
  return `${STORAGE_KEY_PREFIX}${problemId}`
}

function legacyCodeKey(problemId: string): string {
  return `${LEGACY_CODE_KEY_PREFIX}${problemId}`
}

export class LocalStorageSessionRepo implements SessionRepo {
  async get(problemId: string): Promise<SessionSnapshot | null> {
    if (typeof window === 'undefined') return null

    const raw = window.localStorage.getItem(storageKey(problemId))
    if (raw) {
      try {
        return JSON.parse(raw) as SessionSnapshot
      } catch {
        // 数据损坏——落入 legacy 迁移或返回 null
      }
    }

    // 迁移：老版本只在 fedrill:code:<id> 存代码，把它捞进新格式
    const legacyCode = window.localStorage.getItem(legacyCodeKey(problemId))
    if (legacyCode) {
      const now = Date.now()
      const migrated: SessionSnapshot = {
        problemId,
        code: legacyCode,
        messages: [],
        currentRound: 0,
        hintsUsed: 0,
        testedCodeSnapshot: null,
        lastTestResults: null,
        createdAt: now,
        updatedAt: now,
      }
      window.localStorage.setItem(storageKey(problemId), JSON.stringify(migrated))
      window.localStorage.removeItem(legacyCodeKey(problemId))
      return migrated
    }

    return null
  }

  async save(problemId: string, patch: SessionPatch): Promise<void> {
    if (typeof window === 'undefined') return
    const existing = await this.get(problemId)
    const now = Date.now()
    const merged: SessionSnapshot = existing
      ? { ...existing, ...patch, problemId, updatedAt: now }
      : {
          problemId,
          code: '',
          messages: [],
          currentRound: 0,
          hintsUsed: 0,
          testedCodeSnapshot: null,
          lastTestResults: null,
          createdAt: now,
          updatedAt: now,
          ...patch,
        }
    window.localStorage.setItem(storageKey(problemId), JSON.stringify(merged))
  }

  async reset(problemId: string): Promise<void> {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(storageKey(problemId))
    // 顺手清 legacy key，防止下次 get 时又被迁移回来
    window.localStorage.removeItem(legacyCodeKey(problemId))
  }
}

/**
 * 单例工厂——M4 换 Supabase 时改这里，调用方零改动。
 */
let _instance: SessionRepo | null = null

export function getSessionRepo(): SessionRepo {
  if (!_instance) {
    _instance = new LocalStorageSessionRepo()
  }
  return _instance
}
