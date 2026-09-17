import { beforeAll, describe, expect, it } from 'vitest'
import { signToken, verifyToken } from './session'

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-for-session-token'
})

const UID = '11111111-1111-1111-1111-111111111111'

describe('auth session token', () => {
  it('签发后校验通过并还原 userId', () => {
    const token = signToken(UID)
    expect(token).toContain('.')
    expect(verifyToken(token)).toBe(UID)
  })

  it('被篡改 / 格式错误的 token 校验失败', () => {
    const token = signToken(UID)
    expect(verifyToken(token + 'x')).toBeNull()
    expect(verifyToken('not-a-token')).toBeNull()
    expect(verifyToken('abc.')).toBeNull()
    expect(verifyToken('')).toBeNull()
    expect(verifyToken(null)).toBeNull()
    expect(verifyToken(undefined)).toBeNull()
  })

  it('不同 userId 的签名不可互换', () => {
    const a = signToken(UID)
    const b = signToken('22222222-2222-2222-2222-222222222222')
    expect(a).not.toBe(b)
    expect(verifyToken(a)).toBe(UID)
    expect(verifyToken(b)).not.toBe(UID)
  })
})
