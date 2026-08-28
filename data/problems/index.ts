import type { ImplProblemMinimal } from '@/lib/types/problem'
import deepClone from './deep-clone'
import flat from './flat'
import promiseAll from './promise-all'
import myCall from './my-call'
import eventEmitter from './event-emitter'

export const problems: ImplProblemMinimal[] = [
  deepClone,
  flat,
  promiseAll,
  myCall,
  eventEmitter,
]

export const problemsById: Record<string, ImplProblemMinimal> = Object.fromEntries(
  problems.map((p) => [p.id, p]),
)

export const problemsByCategory = problems.reduce<Record<string, ImplProblemMinimal[]>>(
  (acc, p) => {
    const list = acc[p.category] ?? []
    list.push(p)
    acc[p.category] = list
    return acc
  },
  {},
)

export const categoryLabels: Record<string, string> = {
  async: '异步控制',
  prototype: '原型链',
  util: '工具函数',
  pattern: '设计模式',
}

export function getProblem(id: string): ImplProblemMinimal | undefined {
  return problemsById[id]
}
