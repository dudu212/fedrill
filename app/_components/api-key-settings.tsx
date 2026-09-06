'use client'

import { useEffect, useState } from 'react'
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  subscribeApiKey,
} from '@/lib/settings/api-key'

/**
 * BYOK 设置按钮 + 模态框。任意页面 header 里挂一下即可。
 *
 * 交互:
 * - 按钮上直接显示"已配置 ✓"或"未配置 · 点这"
 * - 点开模态,输入 sk-... 保存
 * - 保存 → localStorage · 触发 subscribeApiKey · 其他组件跟着更新
 */
export function ApiKeySettings() {
  const [open, setOpen] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [inputKey, setInputKey] = useState('')

  useEffect(() => {
    setHasKey(!!getApiKey())
    return subscribeApiKey(() => setHasKey(!!getApiKey()))
  }, [])

  const openModal = () => {
    setInputKey(getApiKey() ?? '')
    setOpen(true)
  }

  const save = () => {
    setApiKey(inputKey)
    setOpen(false)
  }

  const remove = () => {
    clearApiKey()
    setInputKey('')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`rounded-md text-sm font-medium transition-all ${
          hasKey
            ? 'border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/25'
            : 'animate-pulse border border-amber-400 bg-amber-500 px-4 py-1.5 text-zinc-950 shadow-lg shadow-amber-500/40 hover:bg-amber-400'
        }`}
        title={
          hasKey
            ? 'DeepSeek API Key 已配置 · 点击可修改'
            : '⚠ 需先配置 DeepSeek API Key 才能对话 · 点击这里'
        }
      >
        {hasKey ? '⚙ API Key ✓' : '⚠ 点这里配置 API Key'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-zinc-700 bg-zinc-950 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-100">
                配置 DeepSeek API Key
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm text-zinc-400">
              <p>
                本站采用 <strong className="text-zinc-200">BYOK</strong>(Bring Your Own Key)
                模式,零成本运营 —— 你需要用自己的 DeepSeek API Key 才能和 AI 对话。
              </p>
              <p className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 text-emerald-200">
                <strong>🔒 零信任 BYOK</strong> · 你输入 Key 之后,浏览器**直接调用 DeepSeek 官方 API**
                (通过 CORS)—— 请求完全**不经过本站服务器**,你的 Key 永远只在你自己的浏览器和 DeepSeek 之间。
              </p>
              <p>
                Key 保存在浏览器 <code className="rounded bg-zinc-800 px-1">localStorage</code>,
                不上传任何第三方。想验证?
                <a
                  href="https://github.com/dudu212/fedrill/blob/main/lib/agent/loop.ts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-400 underline hover:text-blue-300"
                >
                  查看源码 loop.ts
                </a>
                —— 你会看到 <code className="rounded bg-zinc-800 px-1">deepseekStream</code> 是浏览器直调的。
              </p>
              <p>
                没有 Key?去{' '}
                <a
                  href="https://platform.deepseek.com/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  platform.deepseek.com
                </a>{' '}
                注册创建。充值 5 元大约够 500 次对话。
              </p>
            </div>

            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
              placeholder="sk-..."
              autoFocus
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-blue-500"
            />

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={remove}
                disabled={!hasKey}
                className="rounded px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-30"
              >
                清除已保存的 Key
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
                >
                  取消
                </button>
                <button
                  onClick={save}
                  disabled={!inputKey.trim()}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
