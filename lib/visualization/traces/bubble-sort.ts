import type { VizStep, VizTrace } from '../types'

/**
 * 冒泡排序参考轨迹：记录每次「比较 / 交换」后的数组快照。
 *
 * 这是「参考轨迹」方案的生成器——跑的是标准冒泡排序，插桩记录每一步。
 * v1 播放参考算法的轨迹；v2 才插桩用户自己写的排序。
 */
export function bubbleSortTrace(arr: number[]): VizTrace {
  const a = [...arr]
  const steps: VizStep[] = []

  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      // 比较 a[j] 与 a[j+1]
      steps.push({ array: [...a], action: { type: 'compare', indices: [j, j + 1] } })
      if (a[j] > a[j + 1]) {
        // 交换
        ;[a[j], a[j + 1]] = [a[j + 1], a[j]]
        steps.push({ array: [...a], action: { type: 'swap', indices: [j, j + 1] } })
      }
    }
  }

  // 排序完成
  steps.push({ array: [...a], action: { type: 'sorted' } })

  return { initial: [...arr], steps }
}
