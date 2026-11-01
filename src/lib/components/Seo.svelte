<script lang="ts">
  import { page } from '$app/stores'
  import { pageMetadata, SHARE_IMAGE } from '$lib/seo'
  $: meta = pageMetadata($page.url.pathname, $page.status)
</script>

<svelte:head>
  {#if meta.indexable || $page.status >= 400}<title>{meta.title}</title>{/if}
  <meta name="robots" content="{meta.indexable ? 'index,follow' : 'noindex,follow'}" />
  {#if meta.indexable}
    <meta name="description" content="{meta.description}" />
    <link rel="canonical" href="{meta.canonical}" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="Koi-Tre（コイトレ）" />
    <meta property="og:type" content="{meta.article ? 'article' : 'website'}" />
    <meta property="og:title" content="{meta.title}" />
    <meta property="og:description" content="{meta.description}" />
    <meta property="og:url" content="{meta.canonical}" />
    <meta property="og:image" content="{SHARE_IMAGE}" />
    <meta property="og:image:width" content="1448" />
    <meta property="og:image:height" content="1086" />
    <meta property="og:image:alt" content="カフェで穏やかに会話する二人のイラスト" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{meta.title}" />
    <meta name="twitter:description" content="{meta.description}" />
    <meta name="twitter:image" content="{SHARE_IMAGE}" />
  {/if}
</svelte:head>
