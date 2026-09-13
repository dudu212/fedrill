'use client'

import { useMemo } from 'react'
import { ArrayVisualizer } from '@/app/_components/array-visualizer'
import { bubbleSortTrace } from '@/lib/visualization/traces/bubble-sort'

const INITIAL = [5, 2, 8, 1, 9, 3, 7, 4, 6]

export default function AlgoDemoPage() {
  const trace = useMemo(() => bubbleSortTrace(INITIAL), [])

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold">冒泡排序可视化</h1>
      <p className="mb-6 text-sm text-slate-500">
        参考轨迹 · 蓝色=普通，黄色=正在比较，红色=刚交换，绿色=已排好。点「播放」看最大值如何逐个「冒」到末尾。
      </p>
      <ArrayVisualizer trace={trace} />
    </main>
  )
}
