<script lang="ts">
  import type { CharacterId } from '$lib/adventure-catalog'
  import { characters } from '$lib/adventure-catalog'
  export let history: {
    id: string
    characterId: CharacterId
    episodeId: string
    title: string
    profile: string
    total: number
    completedAt: string
  }[] = []
  let selected = ''
  $: groups = [
    ...new Map(
      history.map((item) => [
        `${item.characterId}:${item.episodeId}:${item.profile}`,
        {
          key: `${item.characterId}:${item.episodeId}:${item.profile}`,
          label: `${characters.find((c) => c.id === item.characterId)?.name}・${item.title}`
        }
      ])
    ).values()
  ]
  $: if (groups.length && !groups.some((g) => g.key === selected)) selected = groups[0].key
  $: points = history
    .filter((item) => `${item.characterId}:${item.episodeId}:${item.profile}` === selected)
    .slice(0, 12)
    .reverse()
  $: line = points
    .map(
      (p, i) =>
        `${points.length === 1 ? 300 : 40 + (i * 520) / (points.length - 1)},${170 - p.total * 5.6}`
    )
    .join(' ')
</script>

<section class="growth" aria-label="同じ場面の点数の推移">
  <p class="section-label">話した経験を、振り返る</p>
  <h2>同じ場面で、どう変わった？</h2>
  {#if groups.length}<label for="growth-scene">人物・場面を選ぶ</label><select
      id="growth-scene"
      bind:value="{selected}"
      >{#each groups as group}<option value="{group.key}">{group.label}</option>{/each}</select
    ><svg
      viewBox="0 0 600 210"
      role="img"
      aria-label="{`${points.length}回分の同じ人物・場面の採点。${points.map((p) => `${p.total}点`).join('、')}`}"
      ><line x1="40" y1="170" x2="560" y2="170" stroke="#d5d9ce"
      ></line>{#each [0, 5, 10, 15, 20, 25] as score}<line
          x1="40"
          y1="{170 - score * 5.6}"
          x2="560"
          y2="{170 - score * 5.6}"
          stroke="#e7e9e2"
        ></line><text x="8" y="{175 - score * 5.6}">{score}</text>{/each}<polyline
        points="{line}"
        fill="none"
        stroke="#718562"
        stroke-width="3"
      ></polyline>{#each points as point, index}{@const x =
          points.length === 1 ? 300 : 40 + (index * 520) / (points.length - 1)}<circle
          cx="{x}"
          cy="{170 - point.total * 5.6}"
          r="5"
          fill="#526746"
        ></circle><text x="{x}" y="{158 - point.total * 5.6}" text-anchor="middle"
          >{point.total.toFixed(1)}</text
        ><text x="{x}" y="193" text-anchor="middle"
          >{new Date(point.completedAt).toLocaleDateString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            month: 'numeric',
            day: 'numeric'
          })}</text
        >{/each}</svg
    >
    <p class="small muted">
      同じ人物・場面・新しい採点基準の結果を並べています。点数は目安です。{points.length < 2
        ? 'もう一度練習すると、前回との変化を確認できます。'
        : ''}
    </p>
    <a class="small" href="/practice/{points.at(-1)?.id}">最新の会話と根拠を見る →</a>{:else}<p>
      新しい25点評価の練習を終えると、ここに記録が増えていきます。
    </p>
    <a href="/#scenes">今日の場面を選ぶ →</a>{/if}
</section>

<style>
  .growth {
    padding: 28px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: white;
    margin: 28px 0;
  }
  .growth h2 {
    font-size: 1.35rem;
    margin: 12px 0 20px;
  }
  .growth label {
    display: block;
    font-size: var(--text-sm);
    margin-bottom: 8px;
    color: var(--muted);
  }
  select {
    max-width: 100%;
    width: 100%;
    border: 1px solid var(--border);
    padding: 12px;
    border-radius: 8px;
    color: var(--ink);
    background: var(--surface);
    font-size: var(--text-base);
  }
  svg {
    display: block;
    width: 100%;
    margin: 24px 0 8px;
  }
  svg text {
    font-size: 13px;
    fill: var(--olive);
  }
  .growth > p:not(.section-label) {
    font-size: var(--text-sm);
    line-height: 1.9;
  }
  @media (max-width: 600px) {
    .growth {
      padding: 20px;
    }
    svg text {
      font-size: 14px;
    }
  }
</style>
