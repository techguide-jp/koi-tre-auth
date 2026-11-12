<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import { characters } from '$lib/adventure-catalog'
  import { hasPaidPracticeAccess, type BillingOverview } from '$lib/billing'
  import type { AdventureProgress } from '$lib/adventure'
  import type { CharacterId } from '$lib/adventure-catalog'
  import { billingPortal } from '$lib/billing-client'
  import BillingBalance from '$lib/components/billing/BillingBalance.svelte'
  import PracticeGrowth from '$lib/components/adventure/PracticeGrowth.svelte'
  import TipCollection from '$lib/components/TipCollection.svelte'
  import { storyParts } from '$lib/adventure-story'
  let billing: BillingOverview | null = null
  let knowledgeAdmin = false
  let progress: AdventureProgress | null = null
  let history: {
    id: string
    characterId: CharacterId
    episodeId: string
    title: string
    profile: string
    total: number
    completedAt: string
  }[] = []
  let course: {
    goal: string
    example: string
    part: string
    characterId: CharacterId
    basedOnId: string
    basedOnTitle: string
    aspect: string
  } | null = null
  let pending: 'load' | 'portal' | null = null
  let message = ''
  let success = ''
  let mounted = false
  let alive = false
  let loadedUid = ''
  let selectedCharacter: CharacterId = 'aoi'
  let timer: ReturnType<typeof setTimeout> | undefined
  let retries = 0
  $: practiceCharacters = hasPaidPracticeAccess(billing)
    ? characters.map((c) => c.id)
    : (billing?.ownedCharacters ?? [])
  $: if (mounted && $user && $user.uid !== loadedUid && !pending) {
    loadedUid = $user.uid
    void load()
  }
  $: if (!$user) {
    loadedUid = ''
    billing = null
    knowledgeAdmin = false
    progress = null
    history = []
    course = null
  }
  onMount(() => {
    mounted = true
    alive = true
    return () => {
      alive = false
      clearTimeout(timer)
    }
  })
  async function load() {
    if (pending) return
    pending = 'load'
    message = ''
    const uid = $user?.uid
    try {
      const checkout = $page.url.searchParams.get('checkout')
      if (checkout && /^[0-9a-f-]{36}$/i.test(checkout)) {
        success = ''
        try {
          const reconciled = await authenticatedFetch(`/api/me/billing/checkout/${checkout}`, {
            method: 'POST',
            body: '{}'
          })
          const result = await reconciled.json()
          if (result.pending && alive && retries++ < 8) timer = setTimeout(load, 2500)
          else if (alive)
            success = result.pending
              ? 'お支払いの反映を確認しています。少し待ってから更新してください。'
              : '購入内容を反映しました。'
        } catch (e) {
          if (alive) message = e instanceof Error ? e.message : '購入状態を確認できませんでした。'
        }
      }
      const [b, p, h, permissions] = await Promise.all([
        authenticatedFetch('/api/me/billing'),
        authenticatedFetch('/api/me/adventure'),
        authenticatedFetch('/api/me/practice-history'),
        authenticatedFetch('/api/me/permissions').catch(() => null)
      ])
      const [nextBilling, nextProgress, nextHistory, nextPermissions] = await Promise.all([
        b.json(),
        p.json(),
        h.json(),
        permissions
          ? permissions.json().catch(() => ({ knowledgeAdmin: false }))
          : { knowledgeAdmin: false }
      ])
      if (alive && $user?.uid === uid) {
        knowledgeAdmin = nextPermissions.knowledgeAdmin === true
        billing = nextBilling
        progress = nextProgress
        history = nextHistory.history
        course = nextHistory.course
        if (
          !hasPaidPracticeAccess(nextBilling) &&
          !nextBilling.ownedCharacters.includes(selectedCharacter)
        )
          selectedCharacter = nextBilling.ownedCharacters[0] ?? 'aoi'
      }
    } catch (e) {
      if (alive) message = e instanceof Error ? e.message : 'マイページを読み込めませんでした。'
    } finally {
      if (alive) pending = null
    }
  }
  async function portal() {
    if (pending || !billing?.portalEnabled) return
    pending = 'portal'
    message = ''
    try {
      const result = await billingPortal()
      window.location.assign(result.url)
    } catch (e) {
      if (alive) message = e instanceof Error ? e.message : '契約管理を開けませんでした。'
    } finally {
      if (alive) pending = null
    }
  }
</script>

<svelte:head><title>マイページ・購入と練習の記録 | Koi-Tre</title></svelte:head>
<section class="account-intro">
  <a class="small" href="/#scenes">← お相手・場面選択へ</a>
  <p class="section-label">話した時間を、次の一歩へ。</p>
  <h1>マイページ</h1>
  <p>利用枠、購入した物語、あなたの練習の記録。</p>
  {#if knowledgeAdmin}<a class="small" href="/admin">運営管理：評価方針・知識・人物設定 →</a>{/if}
</section>
{#if !$authReady}<p role="status">ログイン状態を確認しています…</p>{:else if !$user}<div
    class="card"
  >
    <p>ログインすると、購入状況と練習の記録を確認できます。</p>
    <a class="button primary" href="/login?returnTo=account">ログインして開く</a>
  </div>{:else}
  {#if success}<p class="notice" role="status">{success}</p>{/if}{#if message}<p
      class="error"
      role="alert"
    >
      {message}
    </p>{/if}
  <button
    class="text-button refresh"
    disabled="{!!pending}"
    aria-busy="{pending === 'load'}"
    on:click="{load}">{pending === 'load' ? '読み込んでいます…' : '最新の状態を確認する'}</button
  >
  {#key $user.uid}<TipCollection />{/key}
  {#if billing}<div class="account-panels">
      <section class="card"><BillingBalance billing="{billing}" /></section>
      <section class="card">
        <p class="section-label">購入と契約</p>
        <h2>
          {billing.adminPlay
            ? '管理者のプレイ権'
            : billing.subscription?.active
              ? 'Koi-Tre Plus'
              : '無料プラン'}
        </h2>
        {#if billing.subscription}<p>
            状態：{billing.subscription.active
              ? billing.subscription.cancelAtPeriodEnd
                ? '次回更新を停止済み'
                : '利用中'
              : '現在の有料期間は終了しています'}
          </p>
          <p class="small muted">
            {billing.subscription.cancelAtPeriodEnd ? '利用終了日' : '契約期間の末日'}：{new Date(
              billing.subscription.periodEnd
            ).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
          </p>
          <button
            class="button secondary"
            disabled="{!!pending || !billing.portalEnabled}"
            aria-busy="{pending === 'portal'}"
            on:click="{portal}"
            >{pending === 'portal'
              ? '契約管理を開いています…'
              : '契約・解約・支払い方法を管理する'}</button
          >{:else}<p class="small muted">
            {billing.adminPlay
              ? '購入やPlus加入なしで、全員の本編・再練習・クリア後の交流を利用できます。進行条件は通常どおり必要です。'
              : 'Plusで全員の本編を攻略・再練習。人物パックなら、購入した本編を月額なしでも練習できます。'}
          </p>{/if}<a href="/pricing">料金と遊べる範囲 →</a>
        {#if !billing.adminPlay}<p><a href="/pricing#topup">追加の共通15枠 · 550円 →</a></p>{/if}
      </section>
    </div>
    <section class="owned">
      <p class="section-label">あなたの、続きの物語</p>
      <h2>購入したルートパック</h2>
      {#if billing.ownedCharacters.length}<div class="owned-grid">
          {#each billing.ownedCharacters as id}{@const person = characters.find((c) => c.id === id)}
            <article class="card">
              <h3>{person?.name}の本編</h3>
              <p>4〜12話・エンディング</p>
              <a href="/?character={id}#scenes">続き・パートの練習へ →</a>
            </article>{/each}
        </div>{:else}<p>購入済みのルートパックはありません。</p>
        {#if billing.adminPlay}<a href="/#scenes">管理者として本編をプレイする →</a>{:else}<a
            href="/pricing#route-packs">気になる人の本編を見る →</a
          >{/if}{/if}
    </section>
    {#if practiceCharacters.length}<section class="part-practice card">
        <p class="section-label">リアルで話す、その前に。</p>
        <h2>必要なパートへ戻って練習</h2>
        <label for="practice-person">練習するお相手</label><select
          id="practice-person"
          bind:value="{selectedCharacter}"
          >{#each practiceCharacters as id}<option value="{id}"
              >{characters.find((c) => c.id === id)?.name}</option
            >{/each}</select
        >
        <div class="part-links">
          {#each storyParts as part}{@const count = Array.from(
              { length: 3 },
              (_, i) => `${selectedCharacter}:${selectedCharacter}-${part.from + i}`
            ).filter((key) => progress?.completedEpisodes.includes(key)).length}<a
              href="/?character={selectedCharacter}&part={part.id}&mode=revisit#scenes"
              ><strong>{part.label}</strong><span>{count} / 3話をクリア</span></a
            >{/each}
        </div>
        <p class="small muted">
          クリア済みの話を、その時点の関係で再練習できます。進行や選んだ結末はそのままです。
        </p>
      </section>{/if}
    <PracticeGrowth history="{history}" />
    {#if course}<section class="course card">
        <p class="section-label">次に試す、ひとつのこと</p>
        <h2>{course.goal}</h2>
        <p class="small muted">「{course.basedOnTitle}」の{course.aspect}を参考にした練習です。</p>
        <blockquote>例えば「{course.example}」</blockquote>
        <p class="small muted">例文の気持ちは、あなた自身の希望に置き換えてください。</p>
        <a
          class="button secondary"
          href="/?character={course.characterId}&part={course.part}&mode=revisit#scenes"
          >このパートで練習する →</a
        ><a class="small" href="/practice/{course.basedOnId}">もとの会話と根拠を見る</a>
      </section>{/if}
    <p class="small muted">
      保存済みの会話・分析・思い出・好感度・クリア記録は、Plusの契約が終了しても残ります。人物パックの本編利用権と未使用の購入枠も保持します。
    </p>
    <a href="/memories">思い出アルバムを開く →</a>
  {:else if pending}<p role="status">購入状況を読み込んでいます…</p>{/if}
{/if}

<style>
  .account-intro {
    padding: 44px 0 20px;
  }
  .account-intro .section-label {
    margin-top: 28px;
  }
  .account-intro h1 {
    font-size: 2.3rem;
    margin: 12px 0;
  }
  .account-intro > p {
    line-height: 1.8;
  }
  .refresh {
    margin: 8px 0 20px;
  }
  .account-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .card {
    padding: 28px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 18px;
  }
  .card h2 {
    font-size: 1.3rem;
    margin: 12px 0 20px;
  }
  .account-panels .card > a {
    display: block;
    font-size: var(--text-sm);
    margin-top: 18px;
  }
  .account-panels p {
    font-size: var(--text-sm);
    line-height: 1.9;
  }
  .owned {
    margin: 40px 0;
  }
  .owned h2 {
    font-size: 1.4rem;
    margin: 12px 0 20px;
  }
  .owned-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .owned-grid h3 {
    font-size: 1.1rem;
    margin: 0 0 12px;
  }
  .owned-grid p,
  .owned-grid a {
    font-size: var(--text-sm);
    line-height: 1.8;
  }
  .part-practice label {
    display: block;
    font-size: var(--text-sm);
    margin-bottom: 8px;
  }
  select {
    max-width: 100%;
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 8px;
    color: var(--ink);
  }
  .part-links {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin: 20px 0;
  }
  .part-links a {
    padding: 16px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--ink);
    background: var(--surface);
  }
  .part-links strong {
    display: block;
    font-size: var(--text-sm);
  }
  .part-links span {
    display: block;
    font-size: var(--text-sm);
    color: var(--muted);
    margin-top: 8px;
  }
  .part-practice > p:last-child {
    line-height: 1.8;
  }
  .course {
    margin: 28px 0;
  }
  .course blockquote {
    margin: 20px 0;
    padding: 18px;
    background: var(--olive-soft);
    border-radius: 10px;
    font-size: var(--text-base);
    line-height: 1.9;
  }
  .course > a {
    margin-right: 16px;
  }
  .notice {
    padding: 14px 20px;
    background: var(--olive-soft);
    border-radius: 10px;
    font-size: var(--text-sm);
  }
  .error {
    font-size: var(--text-sm);
    line-height: 1.8;
  }
  .account-panels .button {
    font-size: var(--text-sm);
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  @media (max-width: 700px) {
    .account-panels,
    .owned-grid {
      grid-template-columns: 1fr;
    }
    .card {
      padding: 22px;
    }
    .part-links {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .account-intro h1 {
      font-size: 2rem;
    }
    .course > a {
      display: block;
      margin: 12px 0;
    }
  }
</style>
