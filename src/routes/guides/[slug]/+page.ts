import { error } from '@sveltejs/kit'
import { guides } from '$lib/content/guides'
import type { PageLoad } from './$types'

export const prerender = true
export const entries = () => guides.map(({ slug }) => ({ slug }))

export const load: PageLoad = ({ params }) => {
  const guide = guides.find((item) => item.slug === params.slug)
  if (!guide) error(404, 'ガイドが見つかりません。')
  return { guide }
}
