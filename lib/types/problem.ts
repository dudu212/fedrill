import type { TestCase } from '@/lib/sandbox/types'

export type ProblemType = 'implementation' | 'algorithm' | 'theory'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type ImplCategory = 'async' | 'prototype' | 'util' | 'pattern'

export interface BaseProblem {
  id: string
  type: ProblemType
  title: string
  difficulty: Difficulty
  tags: string[]
  description: string
}

export interface EdgeCase {
  id: string
  scenario: string
  hint: string
  testCaseIds?: string[]
}

export interface FollowUpPath {
  round1: string[]
  round2: string[]
  round3: string[]
  round4: string[]
}

export interface ReferenceImpl {
  label: string
  code: string
  explanation: string
}

export interface ImplProblem extends BaseProblem {
  type: 'implementation'
  category: ImplCategory
  requiredAPI: string
  starterCode: string
  testCases: {
    basic: TestCase[]
    edge: TestCase[]
    stress: TestCase[]
  }
  edgeCases: EdgeCase[]
  followUpPath: FollowUpPath
  referenceImpls: ReferenceImpl[]
}

export interface ImplProblemMinimal extends BaseProblem {
  type: 'implementation'
  category: ImplCategory
  requiredAPI: string
  starterCode: string
  testCases: {
    basic: TestCase[]
    edge?: TestCase[]
    stress?: TestCase[]
  }
  edgeCases?: EdgeCase[]
  followUpPath?: Partial<FollowUpPath>
  referenceImpls?: ReferenceImpl[]
}

export type Round = 0 | 1 | 2 | 3 | 4 | 'completed'

export interface ToolCall {
  name: string
  args: Record<string, unknown>
  result?: unknown
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
  timestamp: number
}

export interface Session {
  id: string
  userId?: string
  problemId: string
  messages: ChatMessage[]
  outcome: {
    currentRound: Round
    hintsUsed: number
  }
  createdAt: number
  updatedAt: number
}
