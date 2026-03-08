function getTokyoYearMonthParts(now: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Asia/Tokyo'
  })
  const parts = formatter.formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error('Failed to calculate the current month window')
  }

  return { year, month }
}

function buildTokyoMonthStart(year: number, month: number) {
  return new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`)
}

export function getTokyoMonthStart(now = new Date()) {
  const { year, month } = getTokyoYearMonthParts(now)
  return buildTokyoMonthStart(year, month)
}

export function getNextTokyoMonthStart(now = new Date()) {
  const { year, month } = getTokyoYearMonthParts(now)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  return buildTokyoMonthStart(nextYear, nextMonth)
}
