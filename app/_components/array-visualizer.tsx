'use client'

import { useEffect, useMemo, useState } from 'react'
import { scaleBand, scaleLinear } from 'd3'
import type { VizTrace } from '@/lib/visualization/types'

const BAR_COLOR = '#5b8def'
const COMPARE_COLOR = '#f0b429'
const SWAP_COLOR = '#e0503d'
const SORTED_COLOR = '#38a169'

// 图表坐标：WIDTH×HEIGHT 视图盒；TOP_PAD 顶部留给数值标签；BAR_HEIGHT 柱子最大高度（紧凑）
const WIDTH = 640
const TOP_PAD = 18
const BAR_HEIGHT = 190
const HEIGHT = TOP_PAD + BAR_HEIGHT

const LEGEND = [
  { color: BAR_COLOR, label: '普通' },
  { color: COMPARE_COLOR, label: '比较' },
  { color: SWAP_COLOR, label: '交换' },
  { color: SORTED_COLOR, label: '已排' },
]

/**
 * 数组可视化组件（v1 · 冒泡排序参考轨迹）。
 *
 * D3 的 scaleBand / scaleLinear 负责「值 → 坐标」的映射，
 * React state 负责「当前播放到第几步」，CSS transition 做平滑过渡。
 * 颜色：蓝=普通，黄=正在比较，红=刚交换，绿=已排好。
 *
 * 图表套在玻璃框里（半透明 + backdrop-blur），柱子收窄、柱顶带数值标签，
 * 底部配颜色图例，整体紧凑、精致，正好落在四宫格面板内。
 */
export function ArrayVisualizer({ trace }: { trace: VizTrace }) {
  const [stepIndex, setStepIndex] = useState(-1) // -1 = 初始状态
  const [playing, setPlaying] = useState(false)

  const array = stepIndex < 0 ? trace.initial : trace.steps[stepIndex].array
  const action = stepIndex < 0 ? null : trace.steps[stepIndex].action
  const totalSteps = trace.steps.length
  const atEnd = stepIndex >= totalSteps - 1

  const max = Math.max(...array, 1)

  const xScale = useMemo(
    () =>
      scaleBand<number>()
        .domain(array.map((_, i) => i))
        .range([0, WIDTH])
        .padding(0.4), // 柱间留白更大 → 柱子更窄更精致
    [array.length],
  )
  const yScale = useMemo(
    () => scaleLinear().domain([0, max]).range([0, BAR_HEIGHT]),
    [max],
  )

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

  const btn =
    'rounded-md border border-hairline bg-raised px-2.5 py-1 text-xs text-muted transition-colors hover:border-hairline-strong hover:text-fg'

  return (
    <div className="flex flex-col gap-3">
      {/* 玻璃框 */}
      <div className="mx-auto w-full max-w-[740px] rounded-lg border border-hairline/60 bg-surface/40 p-3 backdrop-blur-sm">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full">
          {array.map((v, i) => {
            const x = xScale(i) ?? 0
            const bw = xScale.bandwidth()
            const h = yScale(v)
            const y = TOP_PAD + (BAR_HEIGHT - h)
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={bw}
                  height={h}
                  rx={2}
                  fill={fill(i)}
                  style={{ transition: 'all 0.25s ease' }}
                />
                <text
                  x={x + bw / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize={10}
                  className="font-mono"
                  style={{ transition: 'all 0.25s ease', fill: 'var(--faint)' }}
                >
                  {v}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 控制条 */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            setPlaying(false)
            setStepIndex(-1)
          }}
          className={btn}
        >
          重置
        </button>
        <button onClick={() => step(-1)} className={btn}>
          上一步
        </button>
        <button
          onClick={togglePlay}
          className="rounded-md bg-accent px-3.5 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-dim"
        >
          {playing ? '暂停' : '播放'}
        </button>
        <button onClick={() => step(1)} className={btn}>
          下一步
        </button>
        <span className="ml-auto font-mono text-xs text-faint">
          步骤 {stepIndex + 1} / {totalSteps}
        </span>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-3 text-[10px] text-faint">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}
