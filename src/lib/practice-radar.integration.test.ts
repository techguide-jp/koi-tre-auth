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
  it('判断保留の軸を飛び越えて線を引かない', () => {
    const chart = createRadarGeometry([3, null, 2, 1, 1])
    expect(chart.polygon).toBeNull()
    expect(chart.segments.map(({ from, to }) => [from, to])).toEqual([
      [2, 3],
      [3, 4],
      [4, 0]
    ])
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
