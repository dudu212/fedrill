'use client'

import { useEffect, useMemo, useState } from 'react'
import { scaleBand, scaleLinear } from 'd3'
import type { VizTrace } from '@/lib/visualization/types'

const BAR_COLOR = '#5b8def'
const COMPARE_COLOR = '#f0b429'
const SWAP_COLOR = '#e0503d'
const SORTED_COLOR = '#38a169'

/**
 * 数组可视化组件（v1 · 冒泡排序参考轨迹）。
 *
 * D3 的 scaleBand / scaleLinear 负责「值 → 坐标」的映射，
 * React state 负责「当前播放到第几步」，CSS transition 做平滑过渡。
 * 颜色：蓝=普通，黄=正在比较，红=刚交换，绿=已排好。
 */
export function ArrayVisualizer({ trace }: { trace: VizTrace }) {
  const [stepIndex, setStepIndex] = useState(-1) // -1 = 初始状态
  const [playing, setPlaying] = useState(false)

  const array = stepIndex < 0 ? trace.initial : trace.steps[stepIndex].array
  const action = stepIndex < 0 ? null : trace.steps[stepIndex].action
  const totalSteps = trace.steps.length
  const atEnd = stepIndex >= totalSteps - 1

  const width = 640
  const height = 320
  const max = Math.max(...array, 1)

  const xScale = useMemo(
    () =>
      scaleBand<number>()
        .domain(array.map((_, i) => i))
        .range([0, width])
        .padding(0.15),
    [array.length],
  )
  const yScale = useMemo(() => scaleLinear().domain([0, max]).range([0, height]), [max])

  useEffect(() => {
    if (!playing) return
    if (atEnd) {
      setPlaying(false)
      return
    }
    const timer = setInterval(() => setStepIndex((i) => i + 1), 400)
    return () => clearInterval(timer)
  }, [playing, atEnd])

  const fill = (i: number) => {
    if (!action) return BAR_COLOR
    if (action.type === 'compare' && action.indices.includes(i)) return COMPARE_COLOR
    if (action.type === 'swap' && action.indices.includes(i)) return SWAP_COLOR
    if (action.type === 'sorted') return SORTED_COLOR
    return BAR_COLOR
  }

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
    } else {
      if (atEnd) setStepIndex(-1)
      setPlaying(true)
    }
  }

  const step = (delta: number) => {
    setPlaying(false)
    setStepIndex((i) => Math.min(totalSteps - 1, Math.max(-1, i + delta)))
  }

  return (
    <div className="flex flex-col gap-4">
      <svg width={width} height={height} className="rounded-lg bg-slate-900">
        {array.map((v, i) => (
          <rect
            key={i}
            x={xScale(i) ?? 0}
            y={height - yScale(v)}
            width={xScale.bandwidth()}
            height={yScale(v)}
            rx={3}
            fill={fill(i)}
            style={{ transition: 'all 0.25s ease' }}
          />
        ))}
      </svg>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setPlaying(false)
            setStepIndex(-1)
          }}
          className="rounded-md bg-slate-200 px-3 py-1.5 text-sm hover:bg-slate-300"
        >
          重置
        </button>
        <button
          onClick={() => step(-1)}
          className="rounded-md bg-slate-200 px-3 py-1.5 text-sm hover:bg-slate-300"
        >
          上一步
        </button>
        <button
          onClick={togglePlay}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {playing ? '暂停' : '播放'}
        </button>
        <button
          onClick={() => step(1)}
          className="rounded-md bg-slate-200 px-3 py-1.5 text-sm hover:bg-slate-300"
        >
          下一步
        </button>
        <span className="text-sm text-slate-500">
          步骤 {stepIndex + 1} / {totalSteps}
        </span>
      </div>
    </div>
  )
}
