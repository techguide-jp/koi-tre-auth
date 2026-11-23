<script lang="ts">
  import { announcements, formatAnnouncementDate } from '$lib/content/announcements'
</script>

{#if announcements.length}
  <section class="announcements" id="announcements" aria-labelledby="announcements-title">
    <h2 id="announcements-title">お知らせ</h2>
    <ul>
      {#each announcements as announcement (announcement.slug)}
        <li>
          <a href="{`/announcements/${announcement.slug}`}">
            <span class="meta">
              <time datetime="{announcement.date}">{formatAnnouncementDate(announcement.date)}</time
              >
              <span class="category">{announcement.category}</span>
            </span>
            <span class="title">{announcement.title}</span>
            <span class="arrow" aria-hidden="true">→</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .announcements {
    display: grid;
    grid-template-columns: 8rem minmax(0, 1fr);
    align-items: start;
    gap: 0.5rem 1.5rem;
    margin: 2rem 0;
    padding: 0.75rem 1.5rem;
    border-block: 1px solid var(--border);
    background: var(--surface);
    scroll-margin-top: 1rem;
  }
  h2 {
    margin: 0.5rem 0;
    font-size: var(--heading-sm);
    text-wrap: nowrap;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  a {
    display: grid;
    grid-template-columns: 15rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.25rem 1rem;
    min-height: 48px;
    padding: 0.6rem 0;
    color: var(--ink);
  }
  a:hover {
    text-decoration: none;
  }
  a:hover .title {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.7rem;
    color: var(--muted);
    font-size: var(--text-xs);
  }
  .category {
    padding: 0.15rem 0.55rem;
    color: var(--accent-hover);
    background: var(--accent-soft);
    border-radius: 2rem;
  }
  .title {
    font-size: var(--text-sm);
    font-weight: 650;
  }
  .arrow {
    color: var(--accent);
  }
  @media (max-width: 760px) {
    .announcements {
      grid-template-columns: 1fr;
      padding: 0.65rem 1rem;
    }
    h2 {
      margin: 0.4rem 0 0;
    }
    a {
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 0.75rem 0;
    }
    .title {
      grid-column: 1;
    }
    .arrow {
      grid-column: 2;
      grid-row: 1 / 3;
    }
  }
</style>
