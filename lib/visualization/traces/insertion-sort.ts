import type { VizStep, VizTrace } from '../types'

/** 插入排序参考轨迹：记录每次「比较 / 交换」后的数组快照 */
export function insertionSortTrace(arr: number[]): VizTrace {
  const a = [...arr]
  const steps: VizStep[] = []
  const n = a.length

  for (let i = 1; i < n; i++) {
    let j = i
    while (j > 0) {
      steps.push({ array: [...a], action: { type: 'compare', indices: [j - 1, j] } })
      if (a[j - 1] > a[j]) {
        ;[a[j - 1], a[j]] = [a[j], a[j - 1]]
        steps.push({ array: [...a], action: { type: 'swap', indices: [j - 1, j] } })
        j--
      } else {
        break
      }
    }
  }

  steps.push({ array: [...a], action: { type: 'sorted' } })
  return { initial: [...arr], steps }
}
