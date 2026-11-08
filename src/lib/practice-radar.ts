const CENTER = { x: 160, y: 143 }
const RADIUS = 84
const AXES = 5

interface Point {
  x: number
  y: number
}

function point(index: number, score: number, maxScore: number): Point {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / AXES
  const radius = (score / maxScore) * RADIUS
  return { x: CENTER.x + Math.cos(angle) * radius, y: CENTER.y + Math.sin(angle) * radius }
}
function coordinates(points: Point[]) {
  return points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
}

export function createRadarGeometry(values: (number | null)[], maxScore: 3 | 5 = 3) {
  if (values.length !== AXES) throw new Error('A practice radar requires five aspects')
  const vertices = values.map((value, index) =>
    value !== null && Number.isFinite(value) && value >= 0 && value <= maxScore
      ? point(index, value, maxScore)
      : null
  )
  const axes = values.map((_, index) => point(index, maxScore, maxScore))
  const rings = Array.from({ length: maxScore }, (_, i) => i + 1).map((level) =>
    coordinates(values.map((_, index) => point(index, level, maxScore)))
  )
  const evaluated = vertices.flatMap((vertex, index) => (vertex ? [{ vertex, index }] : []))
  // 欠測値は補完せず、実在する点を結ぶ。欠測軸をまたぐ接続は画面で点線にする。
  const segments =
    evaluated.length < 2
      ? []
      : evaluated.slice(0, evaluated.length === 2 ? 1 : undefined).map(({ vertex, index }, i) => {
          const next = evaluated[(i + 1) % evaluated.length]
          const distance = Math.abs(next.index - index)
          return {
            from: index,
            to: next.index,
            gap: distance !== 1 && distance !== AXES - 1,
            points: coordinates([vertex, next.vertex])
          }
        })
  const polygon = vertices.every((vertex) => vertex !== null)
    ? coordinates(vertices as Point[])
    : null
  return { center: CENTER, axes, rings, vertices, segments, polygon }
}
