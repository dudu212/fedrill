/**
 * 深度相等比较，判分的最终裁判。
 *
 * 从 worker.ts 抽出，方便单元测试；Worker 从这里 import。
 * 支持：
 * - Object.is（NaN === NaN、-0 !== +0）
 * - Date（按 getTime 比较）
 * - RegExp（按字符串化比较）
 * - 循环引用（WeakMap 跟踪已访问对）
 * - 数组（长度 + 顺序敏感）
 * - 对象（key 集合相同 + 值递归相等；key 顺序无关）
 *
 * 已知盲区（M2 起用 check_edge_case 工具兜底 / M3 可换 fast-deep-equal）：
 * - Symbol 键（Object.keys 拿不到）
 * - Map / Set（会走对象分支被误判相等）
 * - 稀疏数组（arr[i] 全是 undefined 导致误相等）
 */
export function deepEqual(
  a: unknown,
  b: unknown,
  seen: WeakMap<object, object> = new WeakMap(),
): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false

  const aObj = a as object
  if (seen.get(aObj) === b) return true
  seen.set(aObj, b as object)

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b)

  const aIsArr = Array.isArray(a)
  if (aIsArr !== Array.isArray(b)) return false

  if (aIsArr) {
    const arrA = a as unknown[]
    const arrB = b as unknown[]
    if (arrA.length !== arrB.length) return false
    for (let i = 0; i < arrA.length; i++) {
      if (!deepEqual(arrA[i], arrB[i], seen)) return false
    }
    return true
  }

  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>
  const aKeys = Object.keys(objA)
  const bKeys = Object.keys(objB)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(objB, k)) return false
    if (!deepEqual(objA[k], objB[k], seen)) return false
  }
  return true
}
