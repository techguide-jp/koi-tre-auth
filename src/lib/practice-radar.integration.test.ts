import { describe, expect, it } from 'vitest'
import { createRadarGeometry } from './practice-radar'

describe('5観点のレーダーチャート', () => {
  it('判断保留を0にせず、評価できた1項目だけを点で示す', () => {
    const chart = createRadarGeometry([null, null, null, 2.69, null])
    expect(chart.vertices.filter(Boolean)).toHaveLength(1)
    expect(chart.polygon).toBeNull()
    expect(chart.segments).toEqual([])
    expect(chart.vertices[0]).toBeNull()
    expect(chart.vertices[3]).not.toEqual(chart.center)
  })
  it('5項目が揃ったときだけ面を描き、評価済みの0も頂点として保持する', () => {
    const chart = createRadarGeometry([0, 1, 2, 3, 1.5])
    expect(chart.polygon?.split(' ')).toHaveLength(5)
    expect(chart.vertices[0]).toEqual(chart.center)
    expect(chart.segments).toHaveLength(5)
  })
  it('評価済みの点を一周して結び、欠測軸をまたぐ線を区別する', () => {
    const chart = createRadarGeometry([3, null, 2, 1, 1])
    expect(chart.polygon).toBeNull()
    expect(chart.segments.map(({ from, to, gap }) => [from, to, gap])).toEqual([
      [0, 2, true],
      [2, 3, false],
      [3, 4, false],
      [4, 0, false]
    ])
  })
  it('3項目だけでも孤立した点を作らず、面を塗らずに輪郭を閉じる', () => {
    const chart = createRadarGeometry([null, 1.97, null, 2.19, 2.01])
    expect(chart.vertices.filter(Boolean)).toHaveLength(3)
    expect(chart.segments.map(({ from, to, gap }) => [from, to, gap])).toEqual([
      [1, 3, true],
      [3, 4, false],
      [4, 1, true]
    ])
    expect(chart.polygon).toBeNull()
  })
  it('2点は線を重ねず1本で結び、時計回りの先頭と末尾も隣接として扱う', () => {
    const sparse = createRadarGeometry([1, null, 2, null, null])
    expect(sparse.segments).toHaveLength(1)
    expect(sparse.segments[0].gap).toBe(true)
    const adjacent = createRadarGeometry([1, null, null, null, 2])
    expect(adjacent.segments).toHaveLength(1)
    expect(adjacent.segments[0].gap).toBe(false)
    expect(adjacent.polygon).toBeNull()
  })
  it('未評価・不正な値を中心や最大値で補完しない', () => {
    for (const values of [
      [null, null, null, null, null],
      [-1, NaN, Infinity, 3.1, null]
    ]) {
      const chart = createRadarGeometry(values)
      expect(chart.vertices).toEqual([null, null, null, null, null])
      expect(chart.polygon).toBeNull()
      expect(chart.segments).toEqual([])
    }
  })
  it('上から時計回りに5軸を並べ、全頂点を描画領域に収める', () => {
    const chart = createRadarGeometry([3, 3, 3, 3, 3])
    expect(chart.axes[0].x).toBeCloseTo(160)
    expect(chart.axes[0].y).toBeCloseTo(59)
    expect(chart.axes[1].x).toBeGreaterThan(160)
    expect(chart.axes[2].y).toBeGreaterThan(143)
    for (const vertex of chart.axes) {
      expect(vertex.x).toBeGreaterThanOrEqual(0)
      expect(vertex.x).toBeLessThanOrEqual(320)
      expect(vertex.y).toBeGreaterThanOrEqual(0)
      expect(vertex.y).toBeLessThanOrEqual(280)
    }
  })
})
