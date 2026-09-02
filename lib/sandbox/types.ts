export type TestCase = {
  name?: string
  input: unknown[]
  expected: unknown
}

export type TestResult = {
  name?: string
  passed: boolean
  input: unknown[]
  expected: unknown
  actual?: unknown
  error?: string
  durationMs: number
}

export type SandboxRunResult = {
  results: TestResult[]
  totalDurationMs: number
}

export type SandboxRequest = {
  type: 'run'
  code: string
  entryName: string
  cases: TestCase[]
  nonce: string
}

export type SandboxResponse =
  | { type: 'result'; nonce: string; results: TestResult[]; totalDurationMs: number }
  | { type: 'error'; nonce: string; error: string }
