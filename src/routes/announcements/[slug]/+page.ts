import { error } from '@sveltejs/kit'
import { announcements } from '$lib/content/announcements'
import type { PageLoad } from './$types'

export const prerender = true
export const entries = () => announcements.map(({ slug }) => ({ slug }))

export const load: PageLoad = ({ params }) => {
  const announcement = announcements.find(({ slug }) => slug === params.slug)
  if (!announcement) error(404, 'お知らせが見つかりません。')
  return { announcement }
}
