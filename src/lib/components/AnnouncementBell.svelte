<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import { onMount } from 'svelte'
  import { readAnnouncementSlugs } from '$lib/announcement-read-state'
  import { announcements, formatAnnouncementDate } from '$lib/content/announcements'

  let open = false
  let mounted = false
  let container: HTMLDivElement
  let button: HTMLButtonElement
  $: unreadCount = mounted
    ? announcements.filter(({ slug }) => !$readAnnouncementSlugs.has(slug)).length
    : 0

  onMount(() => {
    mounted = true
  })

  afterNavigate(() => {
    open = false
  })

  function closeOutside(event: Event) {
    if (open && event.target instanceof Node && !container.contains(event.target)) open = false
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()
    open = false
    button.focus()
  }
</script>

<svelte:window on:click={closeOutside} on:focusin={closeOutside} on:keydown={closeOnEscape} />

<div class="announcement-menu" bind:this={container}>
  <button
    bind:this={button}
    class="bell"
    type="button"
    aria-label={unreadCount ? `お知らせ（未読${unreadCount}件）` : 'お知らせ'}
    aria-expanded={open}
    aria-controls="header-announcements"
    on:click={() => (open = !open)}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-2 8-2 9h16c0-1-2-2-2-9M10 21h4"></path>
    </svg>
    {#if unreadCount}<span class="bell-dot" aria-hidden="true"></span>{/if}
  </button>

  <section
    class="panel"
    id="header-announcements"
    aria-labelledby="header-announcements-title"
    hidden={!open}
  >
    <h2 id="header-announcements-title">お知らせ</h2>
    {#if announcements.length}
      <ul>
        {#each announcements as announcement (announcement.slug)}
          <li>
            <a href={`/announcements/${announcement.slug}`}>
              <span class="item-title">
                {#if !$readAnnouncementSlugs.has(announcement.slug)}
                  <span class="item-dot" aria-hidden="true"></span>
                  <span class="visually-hidden">未読：</span>
                {/if}
                {announcement.title}
              </span>
              <time datetime={announcement.date}>{formatAnnouncementDate(announcement.date)}</time>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p>お知らせはありません。</p>
    {/if}
  </section>
</div>

<style>
  .announcement-menu {
    position: relative;
    flex: none;
  }
  .bell {
    position: relative;
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: 50%;
    color: var(--ink);
    background: var(--surface);
    cursor: pointer;
  }
  .bell:hover,
  .bell[aria-expanded='true'] {
    color: var(--accent-hover);
    background: var(--accent-soft);
  }
  .bell svg {
    width: 22px;
    height: 22px;
  }
  .bell-dot,
  .item-dot {
    background: #c12f4a;
    border-radius: 50%;
  }
  .bell-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 11px;
    height: 11px;
    border: 2px solid var(--surface);
  }
  .panel {
    position: absolute;
    z-index: 20;
    inset: calc(100% + 0.6rem) 0 auto auto;
    width: min(23rem, calc(100vw - 2.5rem));
    max-height: min(28rem, 65vh);
    overflow-y: auto;
    overscroll-behavior: contain;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 16px 40px #42353e24;
  }
  h2 {
    margin: 0;
    padding: 0.75rem 1rem;
    font-size: var(--heading-sm);
  }
  li,
  p {
    border-top: 1px solid var(--border);
  }
  p,
  a {
    padding: 0.8rem 1rem;
  }
  a {
    display: grid;
    gap: 0.2rem;
    color: var(--ink);
    font-size: var(--text-sm);
    line-height: 1.6;
  }
  a:hover,
  a:focus-visible {
    background: var(--accent-soft);
  }
  a:focus-visible {
    outline-offset: -3px;
  }
  .item-title {
    font-weight: 650;
    text-wrap: pretty;
    word-break: auto-phrase;
  }
  .item-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-inline-end: 0.25rem;
    vertical-align: 0.15em;
  }
  time {
    color: var(--muted);
    font-size: var(--text-xs);
  }
  @media (max-width: 700px) {
    .announcement-menu {
      position: static;
    }
    .panel {
      top: calc(100% + 0.35rem);
      right: var(--header-padding-inline);
    }
  }
</style>
