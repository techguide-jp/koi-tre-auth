<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import { markAnnouncementRead } from '$lib/announcement-read-state'
  import { formatAnnouncementDate } from '$lib/content/announcements'
  import type { PageData } from './$types'

  export let data: PageData
  $: announcement = data.announcement

  afterNavigate(() => markAnnouncementRead(data.announcement.slug))
</script>

<article class="announcement">
  <a class="back-link" href="/#announcements"><span aria-hidden="true">←</span> お知らせ一覧</a>
  <header>
    <div class="meta">
      <span class="category">{announcement.category}</span>
      <time datetime="{announcement.date}">{formatAnnouncementDate(announcement.date)}</time>
    </div>
    <h1>{announcement.title}</h1>
    <p class="summary">{announcement.summary}</p>
  </header>
  <img
    class="cover"
    src="{announcement.image.src}"
    alt="{announcement.image.alt}"
    width="{announcement.image.width}"
    height="{announcement.image.height}"
    fetchpriority="high"
  />
  <div class="body">
    {#each announcement.sections as section}
      <section>
        <h2>{section.title}</h2>
        <p>{section.body}</p>
      </section>
    {/each}
    {#if announcement.action}
      <a class="button primary" href="{announcement.action.href}">
        {announcement.action.label} <span aria-hidden="true">→</span>
      </a>
    {/if}
  </div>
</article>

<style>
  .announcement {
    width: 100%;
    max-width: 54rem;
    margin: 2rem auto clamp(3rem, 8vw, 6rem);
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 44px;
    font-size: var(--text-sm);
  }
  header {
    margin: clamp(1rem, 4vw, 2rem) 0 1.5rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem 0.85rem;
    color: var(--muted);
    font-size: var(--text-sm);
  }
  .category {
    padding: 0.25rem 0.7rem;
    background: var(--accent-soft);
    border-radius: 2rem;
    color: var(--accent-hover);
    font-weight: 650;
  }
  h1 {
    margin: 0.5rem 0 0.75rem;
    word-break: auto-phrase;
  }
  .summary {
    max-width: 40rem;
    margin: 0;
    color: var(--muted);
    font-size: var(--text-lead);
  }
  .cover {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    background: var(--surface-soft);
    border-radius: clamp(12px, 2vw, 20px);
  }
  .body {
    width: 100%;
    max-width: 42rem;
    margin: 2rem auto 0;
  }
  section {
    margin: 0 0 1.5rem;
    padding: 0 0 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  .body h2 {
    margin: 0 0 0.5rem;
    font-size: var(--heading-sm);
    color: var(--accent-hover);
  }
  .body p {
    margin: 0;
  }
</style>
