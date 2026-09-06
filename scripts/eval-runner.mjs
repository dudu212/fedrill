// 运行 promptfoo eval · 自动把 DEEPSEEK_API_KEY 映射到 OPENAI_API_KEY
// (DeepSeek 走 openai:chat 兼容协议,promptfoo openai provider 从 OPENAI_API_KEY 读 key)
//
// 用法:node --env-file=.env.local scripts/eval-runner.mjs [额外 promptfoo 参数]
// 通过 package.json 的 test:eval 脚本触发。

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

// 把 DEEPSEEK_API_KEY 复用给 openai 系 provider · 不覆盖已存在的 OPENAI_API_KEY
process.env.OPENAI_API_KEY ??= process.env.DEEPSEEK_API_KEY

// 直接调 promptfoo 的 node entry,绕开 Windows 上 .cmd shim 的 shell 转义坑
const promptfooEntry = resolve(
  process.cwd(),
  'node_modules',
  'promptfoo',
  'dist',
  'src',
  'entrypoint.js',
)

const args = [
  promptfooEntry,
  'eval',
  '-c',
  'tests/eval/promptfooconfig.yaml',
  ...process.argv.slice(2),
]

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => process.exit(code ?? 1))
