export function practiceEnabled() {
  return process.env.PRACTICE_ENABLED === 'true'
}

export function practiceConfigured() {
  return Boolean(process.env.DIFY_PRACTICE_API_KEY)
}
