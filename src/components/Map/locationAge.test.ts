import { describe, expect, it } from 'vitest'
import { formatLocationAge } from './locationAge'

const NOW = new Date('2026-09-01T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

describe('formatLocationAge', () => {
  it('null / undefined / 不正値は 不明', () => {
    expect(formatLocationAge(null, NOW)).toBe('不明')
    expect(formatLocationAge(undefined, NOW)).toBe('不明')
    expect(formatLocationAge('not-a-date', NOW)).toBe('不明')
  })

  it('1分未満は たった今', () => {
    expect(formatLocationAge(ago(0), NOW)).toBe('たった今')
    expect(formatLocationAge(ago(59_000), NOW)).toBe('たった今')
  })

  it('分・時間・日で切り替わる（境界）', () => {
    expect(formatLocationAge(ago(60_000), NOW)).toBe('1分前')
    expect(formatLocationAge(ago(59 * 60_000), NOW)).toBe('59分前')
    expect(formatLocationAge(ago(60 * 60_000), NOW)).toBe('1時間前')
    expect(formatLocationAge(ago(23 * 3_600_000), NOW)).toBe('23時間前')
    expect(formatLocationAge(ago(24 * 3_600_000), NOW)).toBe('1日前')
  })

  it('切り捨てで表示する', () => {
    expect(formatLocationAge(ago(90_000), NOW)).toBe('1分前')
    expect(formatLocationAge(ago(2.9 * 3_600_000), NOW)).toBe('2時間前')
    expect(formatLocationAge(ago(3.9 * 86_400_000), NOW)).toBe('3日前')
  })

  it('何日でも日数で出し続ける（打ち切らない）', () => {
    expect(formatLocationAge(ago(90 * 86_400_000), NOW)).toBe('90日前')
  })

  it('未来の時刻は たった今 に丸める（端末の時計ずれ対策）', () => {
    expect(formatLocationAge(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe('たった今')
  })
})
