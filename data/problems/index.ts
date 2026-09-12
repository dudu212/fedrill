import type { ImplProblemMinimal } from '@/lib/types/problem'
import deepClone from './deep-clone'
import flat from './flat'
import deepMerge from './deep-merge'
import arrayDedupe from './array-dedupe'
import myReduce from './my-reduce'
import promiseAll from './promise-all'
import promiseRace from './promise-race'
import promiseAllSettled from './promise-all-settled'
import asyncSeries from './async-series'
import myCall from './my-call'
import myInstanceof from './my-instanceof'
import myNew from './my-new'
import myApply from './my-apply'
import eventEmitter from './event-emitter'
import singleton from './singleton'

export const problems: ImplProblemMinimal[] = [
  deepClone,
  flat,
  deepMerge,
  arrayDedupe,
  myReduce,
  promiseAll,
  promiseRace,
  promiseAllSettled,
  asyncSeries,
  myCall,
  myInstanceof,
  myNew,
  myApply,
  eventEmitter,
  singleton,
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
