import { bubbleSortTrace } from './bubble-sort'
import { selectionSortTrace } from './selection-sort'
import { insertionSortTrace } from './insertion-sort'
import type { VizTrace } from '../types'

/** 有「数组排序参考轨迹」的题目 id → trace 生成器 */
const ARRAY_TRACES: Record<string, (arr: number[]) => VizTrace> = {
  'bubble-sort': bubbleSortTrace,
  'selection-sort': selectionSortTrace,
  'insertion-sort': insertionSortTrace,
}

/** 按题目 id 取数组排序 trace；没有可视化（非排序题）返回 null */
export function getArrayTrace(problemId: string, arr: number[]): VizTrace | null {
  const fn = ARRAY_TRACES[problemId]
  return fn ? fn(arr) : null
}
