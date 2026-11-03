import { practiceEnabled } from '$lib/server/practice-config'

export function load() {
  return { practiceEnabled: practiceEnabled() }
}
