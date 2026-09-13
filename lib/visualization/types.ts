/**
 * 算法可视化的轨迹数据模型（M3）。
 *
 * 「参考轨迹」方案：题目自带预计算好的执行步骤（每步数组快照 + 动作），
 * 可视化组件只负责播放。步骤由参考算法「插桩」生成，见 traces/。
 */

/** 一步动作：这一步发生了什么 */
export type VizAction =
  | { type: 'compare'; indices: [number, number] }
  | { type: 'swap'; indices: [number, number] }
  | { type: 'sorted' }

/** 一步：动作 + 动作后的数组快照 */
export type VizStep = {
  array: number[]
  action: VizAction
}

/** 完整轨迹：初始数组 + 所有步骤 */
export type VizTrace = {
  initial: number[]
  steps: VizStep[]
}
