import { describe, it, expect } from 'vitest'
import { deepEqual } from './deep-equal'

describe('deepEqual', () => {
  describe('原始值 · Object.is 语义', () => {
    it('相同数字相等', () => {
      expect(deepEqual(1, 1)).toBe(true)
    })

    it('不同数字不等', () => {
      expect(deepEqual(1, 2)).toBe(false)
    })

    it('NaN 等于自身（Object.is 语义，与 === 不同）', () => {
      expect(deepEqual(NaN, NaN)).toBe(true)
    })

    it('-0 不等于 +0（Object.is 语义，与 === 不同）', () => {
      expect(deepEqual(-0, +0)).toBe(false)
    })

    it('null 等于 null', () => {
      expect(deepEqual(null, null)).toBe(true)
    })

    it('null 不等于 undefined', () => {
      expect(deepEqual(null, undefined)).toBe(false)
    })

    it('相同字符串相等', () => {
      expect(deepEqual('abc', 'abc')).toBe(true)
    })
  })

  describe('数组 · 顺序敏感', () => {
    it('空数组相等', () => {
      expect(deepEqual([], [])).toBe(true)
    })

    it('相同内容相同顺序相等', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    })

    it('不同顺序不等（顺序敏感）', () => {
      expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false)
    })

    it('长度不同不等', () => {
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it('嵌套数组递归比较', () => {
      expect(deepEqual([1, [2, [3]]], [1, [2, [3]]])).toBe(true)
      expect(deepEqual([1, [2, [3]]], [1, [2, [4]]])).toBe(false)
    })
  })

  describe('对象 · key 顺序无关', () => {
    it('空对象相等', () => {
      expect(deepEqual({}, {})).toBe(true)
    })

    it('相同 key 相同值相等（不管构造顺序）', () => {
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    })

    it('key 集合不同不等', () => {
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
      expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
    })

    it('嵌套对象递归比较', () => {
      expect(
        deepEqual(
          { x: { y: { z: 1 } } },
          { x: { y: { z: 1 } } },
        ),
      ).toBe(true)
      expect(
        deepEqual(
          { x: { y: { z: 1 } } },
          { x: { y: { z: 2 } } },
        ),
      ).toBe(false)
    })
  })

  describe('内建类型', () => {
    it('相同时间的 Date 对象相等（即便是不同实例）', () => {
      expect(deepEqual(new Date('2026-08-28'), new Date('2026-08-28'))).toBe(
        true,
      )
    })

    it('不同时间的 Date 不等', () => {
      expect(deepEqual(new Date('2026-08-28'), new Date('2026-08-29'))).toBe(
        false,
      )
    })

    it('相同模式的 RegExp 相等', () => {
      expect(deepEqual(/abc/gi, /abc/gi)).toBe(true)
    })

    it('不同模式的 RegExp 不等', () => {
      expect(deepEqual(/abc/g, /abc/i)).toBe(false)
    })
  })

  describe('循环引用（deep-clone 题的核心考点）', () => {
    it('两侧都自引用，视作相等', () => {
      const a: Record<string, unknown> = { name: 'x' }
      a.self = a
      const b: Record<string, unknown> = { name: 'x' }
      b.self = b
      expect(deepEqual(a, b)).toBe(true)
    })

    it('循环引用 + 不同数据，视作不等', () => {
      const a: Record<string, unknown> = { name: 'x' }
      a.self = a
      const b: Record<string, unknown> = { name: 'y' }
      b.self = b
      expect(deepEqual(a, b)).toBe(false)
    })
  })

  describe('类型不匹配', () => {
    it('数组 vs 对象不等', () => {
      expect(deepEqual([], {})).toBe(false)
    })

    it('原始值 vs 对象不等', () => {
      expect(deepEqual(1, { valueOf: () => 1 })).toBe(false)
    })
  })
})
