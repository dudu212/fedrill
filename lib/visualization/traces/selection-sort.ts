import type { VizStep, VizTrace } from '../types'

/** 选择排序参考轨迹：记录每次「比较 / 交换」后的数组快照 */
export function selectionSortTrace(arr: number[]): VizTrace {
  const a = [...arr]
  const steps: VizStep[] = []
  const n = a.length

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i
    for (let j = i + 1; j < n; j++) {
      steps.push({ array: [...a], action: { type: 'compare', indices: [minIdx, j] } })
      if (a[j] < a[minIdx]) minIdx = j
    }
    if (minIdx !== i) {
      ;[a[i], a[minIdx]] = [a[minIdx], a[i]]
      steps.push({ array: [...a], action: { type: 'swap', indices: [i, minIdx] } })
    }
  }

  steps.push({ array: [...a], action: { type: 'sorted' } })
  return { initial: [...arr], steps }
}
