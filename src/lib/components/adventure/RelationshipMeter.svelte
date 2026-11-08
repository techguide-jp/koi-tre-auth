<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { tweened } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { affinityLabel } from '$lib/adventure-progression'
  export let name: string
  export let value: number
  export let required = 0
  export let previous: number | null = null
  export let animate = false

  const clamp = (amount: number) => Math.max(0, Math.min(100, amount))
  const heartLevel = (amount: number, index: number) => clamp((amount - index * 20) * 5)
  const heartPath = 'M50 94C36 83 5 62 5 34C5 9 33-1 50 19C67-1 95 9 95 34C95 62 64 83 50 94Z'
  const heartMask = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${heartPath}"/></svg>`)}")`
  const displayed = tweened(animate && previous !== null ? clamp(previous) : clamp(value))
  let container: HTMLDivElement
  let mounted = false
  let visible = false
  let reducedMotion = false
  let celebrating = false
  let activeKey = ''
  let revision = 0
  let finishTimer: ReturnType<typeof setTimeout> | undefined
  $: current = clamp(value)
  $: before = previous === null ? null : clamp(previous)
  $: gain = before === null ? 0 : current - before
  $: if (mounted) updateLevel(current, before, animate, visible, reducedMotion)

  onMount(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => (reducedMotion = preference.matches)
    updatePreference()
    preference.addEventListener('change', updatePreference)
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => (visible = entry.intersectionRatio >= 0.35), {
            threshold: 0.35
          })
    if (observer) observer.observe(container)
    else visible = true
    mounted = true
    return () => {
      mounted = false
      revision++
      clearTimeout(finishTimer)
      observer?.disconnect()
      preference.removeEventListener('change', updatePreference)
    }
  })

  function updateLevel(
    target: number,
    start: number | null,
    animateChange: boolean,
    inView: boolean,
    reduceMotion: boolean
  ) {
    const key = `${target}:${start}:${animateChange}`
    if (activeKey === key) {
      if (reduceMotion) {
        void displayed.set(target, { duration: 0 })
        celebrating = false
        clearTimeout(finishTimer)
      }
      return
    }
    const attempt = ++revision
    celebrating = false
    clearTimeout(finishTimer)
    if (!animateChange || start === null || start === target || reduceMotion) {
      activeKey = key
      void displayed.set(target, { duration: 0 })
      return
    }
    // 結果を見た瞬間に実際の差分を見せ、スクロールし直しても獲得演出を繰り返さない。
    void displayed.set(start, { duration: 0 })
    if (!inView) return
    activeKey = key
    void tick().then(() => {
      if (!mounted || attempt !== revision) return
      celebrating = target > start
      void displayed.set(target, { duration: 1250, easing: cubicOut }).then(() => {
        if (mounted && attempt === revision)
          finishTimer = setTimeout(() => (celebrating = false), 500)
      })
    })
  }
</script>

<div class="relationship" class:celebrating="{celebrating}" bind:this="{container}">
  <div class="heading">
    <span>{name}との好感度</span><strong>{Math.round($displayed)}<small> / 100</small></strong>
  </div>
  <div
    class="heart-meter"
    role="progressbar"
    aria-label="{`${name}との好感度`}"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow="{current}"
    aria-valuetext="{`${current}点、100点満点。${affinityLabel(current)}。ハート1つで20点。`}"
    style="{`--heart-mask:${heartMask}`}"
  >
    {#each [0, 1, 2, 3, 4] as index}{@const level = heartLevel($displayed, index)}{@const changed =
        before !== null && heartLevel(before, index) < heartLevel(current, index)}
      <div class="heart" class:changed="{changed}" aria-hidden="true">
        <div class="heart-shape">
          <div class="heart-liquid" style="{`height:${level * 0.9}%`}">
            {#if level > 0 && level < 100}<svg
                class="liquid-surface"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                ><path d="M0 6Q25 0 50 6T100 6T150 6T200 6V12H0Z"></path></svg
              >{/if}
          </div>
        </div>
        <svg class="heart-glass" viewBox="0 0 100 100" fill="none">
          <path class="heart-outline" d="{heartPath}"></path>
          <path class="heart-shine" d="M16 32C16 19 27 14 35 19"></path>
        </svg>
        {#if changed && celebrating}<span class="heart-spark first">♥</span><span
            class="heart-spark second">♥</span
          >{/if}
      </div>{/each}
    {#if celebrating && gain > 0}<span class="gain" aria-hidden="true">+{gain} ♡</span>{/if}
  </div>
  <div class="relationship-caption">
    <span class="relationship-label">{affinityLabel(Math.round($displayed))}</span><span
      class="scale">ハートひとつで20</span
    >
  </div>
  {#if required > current}<p class="next-condition">
      この話まで、あと<strong>{required - current}</strong>
    </p>{/if}
</div>

<style>
  .relationship {
    padding: 18px 20px;
    border: 1px solid #dfc6c9;
    border-radius: 16px;
    background: radial-gradient(ellipse at 50% 30%, #fff9f6, #fcf0ed 80%);
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.8rem;
    color: #874d50;
  }
  .heading strong {
    font-size: 1.55rem;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-weight: 400;
    font-size: 0.7rem;
  }
  .heart-meter {
    display: flex;
    justify-content: center;
    position: relative;
    gap: 6px;
    width: 100%;
    max-width: 340px;
    margin: 14px auto 10px;
  }
  .heart {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    max-width: 60px;
    aspect-ratio: 1;
    filter: drop-shadow(0 2px 2px #b7808b18);
  }
  .heart-shape {
    position: absolute;
    inset: 0;
    background: #f1e2e1;
    -webkit-mask-image: var(--heart-mask);
    mask-image: var(--heart-mask);
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .heart-liquid {
    position: absolute;
    bottom: 6%;
    width: 100%;
    background: linear-gradient(#ed9aad, #d25d7e);
  }
  .liquid-surface {
    position: absolute;
    width: 200%;
    height: 10px;
    top: -5px;
    left: -50%;
    fill: #ed9aad;
    animation: ripple 2.8s ease-in-out infinite alternate;
  }
  .heart-glass {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .heart-outline {
    stroke: #c9959d;
    stroke-width: 1.8;
  }
  .heart-shine {
    stroke: #fffaf9;
    stroke-width: 5;
    stroke-linecap: round;
    opacity: 0.85;
  }
  .celebrating .heart.changed {
    animation: heart-bloom 1100ms ease-in-out;
  }
  .heart-spark {
    position: absolute;
    left: 45%;
    top: 10%;
    font-size: 0.8rem;
    color: #ce5e7a;
    pointer-events: none;
    opacity: 0;
    animation: heart-rise 1200ms ease-out 150ms both;
  }
  .heart-spark.second {
    left: 65%;
    font-size: 0.6rem;
    animation-delay: 350ms;
  }
  .gain {
    position: absolute;
    right: 0;
    top: -8px;
    padding: 5px 9px;
    border-radius: 20px;
    background: #a84762;
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    box-shadow: 0 3px 12px #a8476220;
    pointer-events: none;
    animation: gain-appear 350ms ease-out both;
  }
  .relationship-caption {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px 12px;
    font-size: 0.75rem;
    color: #8b5b60;
  }
  .relationship-label {
    font-weight: 600;
  }
  .scale {
    font-size: 0.65rem;
    color: #947b7a;
  }
  .next-condition {
    margin: 10px 0 0;
    font-size: 0.75rem;
    color: #a34d3e;
  }
  .next-condition strong {
    margin-left: 3px;
    font-variant-numeric: tabular-nums;
  }
  @keyframes ripple {
    from {
      transform: translateX(-7%);
    }
    to {
      transform: translateX(7%);
    }
  }
  @keyframes heart-bloom {
    0%,
    100% {
      transform: scale(1);
    }
    45% {
      transform: scale(1.13);
      filter: drop-shadow(0 0 7px #d86e8b55);
    }
  }
  @keyframes heart-rise {
    0% {
      transform: translate(-50%, 4px) scale(0.5);
      opacity: 0;
    }
    25% {
      opacity: 0.9;
    }
    100% {
      transform: translate(-80%, -30px) scale(1.1);
      opacity: 0;
    }
  }
  @keyframes gain-appear {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.8);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .liquid-surface,
    .celebrating .heart.changed,
    .heart-spark,
    .gain {
      animation: none;
    }
  }
</style>
