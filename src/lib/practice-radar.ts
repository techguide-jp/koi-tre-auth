const CENTER = { x: 160, y: 143 }
const RADIUS = 84
const AXES = 5

interface Point {
  x: number
  y: number
}

function point(index: number, score: number): Point {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / AXES
  const radius = (score / 3) * RADIUS
  return { x: CENTER.x + Math.cos(angle) * radius, y: CENTER.y + Math.sin(angle) * radius }
}
function coordinates(points: Point[]) {
  return points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
}

export function createRadarGeometry(values: (number | null)[]) {
  if (values.length !== AXES) throw new Error('A practice radar requires five aspects')
  const vertices = values.map((value, index) =>
    value !== null && Number.isFinite(value) && value >= 0 && value <= 3
      ? point(index, value)
      : null
  )
  const axes = values.map((_, index) => point(index, 3))
  const rings = [1, 2, 3].map((level) => coordinates(values.map((_, index) => point(index, level))))
  // 欠測した軸を中心へ落としたり、その前後を結んだりすると架空の形になる。
  const segments = vertices.flatMap((vertex, index) => {
    const nextIndex = (index + 1) % AXES
    const next = vertices[nextIndex]
    return vertex && next
      ? [{ from: index, to: nextIndex, points: coordinates([vertex, next]) }]
      : []
  })
  const polygon = vertices.every((vertex) => vertex !== null)
    ? coordinates(vertices as Point[])
    : null
  return { center: CENTER, axes, rings, vertices, segments, polygon }
}
