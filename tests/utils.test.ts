import { describe, expect, test } from 'vitest'
import { compareVersion } from '../src/utils/compareVersion'

describe('compareVersion', () => {
  test('left 大于 right 返回 1', () => {
    expect(compareVersion('1.2.0', '1.1.9')).toBe(1)
  })

  test('left 等于 right 返回 0', () => {
    expect(compareVersion('1.2.0', '1.2.0')).toBe(0)
  })

  test('left 小于 right 返回 -1', () => {
    expect(compareVersion('1.1.9', '1.2.0')).toBe(-1)
  })

  test('不同长度版本号正确比较', () => {
    expect(compareVersion('1.0', '1.0.1')).toBe(-1)
    expect(compareVersion('1.0.1', '1.0')).toBe(1)
  })
})
