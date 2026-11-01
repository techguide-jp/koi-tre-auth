<script lang="ts">
  import type { BuiltInSceneId } from '$lib/practice'
  export let scene: BuiltInSceneId
</script>

<svg viewBox="0 0 160 110" fill="none" aria-hidden="true">
  {#if scene === 'cafe'}
    <ellipse cx="78" cy="91" rx="61" ry="5" fill="#dbd8c9"></ellipse>
    <path d="M31 46h43l-3 24c-2 14-34 14-37 0z" fill="#f4ebe0"></path>
    <path d="M31 46h43l-3 24c-2 14-34 14-37 0zM75 50c24-5 19 23-3 20M26 85h54"></path>
    <path d="M91 53h34l-3 20c-2 11-27 11-29 0z" fill="#c4cdbb"></path>
    <path
      d="M91 53h34l-3 20c-2 11-27 11-29 0zM126 57c19-4 16 18-3 17M87 87h44M46 34c-9-11 9-10 0-23M62 34c-8-9 7-11 1-18M107 42c-8-10 7-11 0-22"
    ></path>
  {:else if scene === 'hobbies'}
    <path d="M34 88c0-9 6-25 14-34 7 4 21 6 32 0 9 8 15 19 17 34z" fill="#c4cdbb" stroke="none"
    ></path>
    <path
      d="M30 88h70M48 50c-6-3-5-11 0-13l3-15c2-8 17-10 20-1l4 16c10 1 12 13 6 17M36 65c19 2 41 8 57 11M49 54l-4 33M80 54l6 34"
    ></path>
    <path d="m98 41 24-8 12 42-24 8z" fill="#efd4b9"></path>
    <path d="m98 41 24-8 12 42-24 8zM105 45l12-4M107 51l12-4M110 57l12-4M114 71l7-2"></path>
    <path d="M22 25c9-13 20-10 23-6M91 17l6 5M99 9l4 6"></path>
  {:else}
    <ellipse cx="80" cy="79" rx="43" ry="13" fill="#efd4b9" stroke="none"></ellipse>
    <ellipse cx="80" cy="75" rx="43" ry="13"></ellipse>
    <ellipse cx="80" cy="75" rx="32" ry="7"></ellipse>
    <path
      d="M22 28v18m-6-18v10c0 7 12 7 12 0V28M22 44v42M139 26c-10 8-10 22 0 25v35M139 26v25M51 19h28c11 0 15 18 3 23l-6 10-5-10H51c-14 0-14-23 0-23z"
    ></path>
    <path d="M60 30h1m8 0h1m8 0h1" stroke-width="3"></path>
    <path d="m100 37 5-7m7 15 8-2"></path>
  {/if}
</svg>

<style>
  svg {
    width: 160px;
    height: 110px;
    stroke: #4a5147;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
