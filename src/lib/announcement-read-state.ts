import { browser } from '$app/environment'
import { readonly, writable } from 'svelte/store'
import { announcements } from '$lib/content/announcements'

const storagePrefix = 'koi-announcement-read:'

const read = writable<ReadonlySet<string>>(new Set(), (set) => {
  if (!browser) return

  function refresh() {
    try {
      const saved = announcements
        .map(({ slug }) => slug)
        .filter((slug) => localStorage.getItem(storagePrefix + slug) === '1')
      set(new Set(saved))
    } catch {
      // 保存を許可しないブラウザーでも、そのページでの既読はメモリーに残す。
    }
  }

  function sync(event: StorageEvent) {
    if (event.key === null || event.key.startsWith(storagePrefix)) refresh()
  }

  refresh()
  window.addEventListener('storage', sync)
  return () => window.removeEventListener('storage', sync)
})

export const readAnnouncementSlugs = readonly(read)

export function markAnnouncementRead(slug: string) {
  if (!browser) return

  try {
    localStorage.setItem(storagePrefix + slug, '1')
  } catch {
    // 保存できない場合も、開いたお知らせは現在のタブで既読にする。
  }
  read.update((slugs) => (slugs.has(slug) ? slugs : new Set([...slugs, slug])))
}
