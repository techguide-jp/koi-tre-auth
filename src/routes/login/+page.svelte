<script lang="ts">
  import { getAdditionalUserInfo, signInWithPopup } from 'firebase/auth'
  import { onMount } from 'svelte'
  import { auth, provider } from '$lib/firebaseConfig'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import {
    findScene,
    normalizeCustomScene,
    resolveScene,
    type CustomSceneInput
  } from '$lib/practice'
  import { readCustomSceneDraft } from '$lib/custom-scene-client'
  import { startPractice } from '$lib/practice-client'
  import { normalizeAdventure } from '$lib/adventure'
  import { syncCurrentUserToApi, user } from '$lib/stores'
  import { setAnalyticsUser, trackLogin, trackSignup } from '$lib/analytics'
  let message = ''
  let pending = false
  let customScene: CustomSceneInput | null = null
  let customDraftReady = false
  onMount(() => {
    customScene = normalizeCustomScene(
      readCustomSceneDraft($page.url.searchParams.get('preset') === '1' ? 'preset' : 'custom')
    )
    customDraftReady = true
  })
  $: isCustom = $page.url.searchParams.get('scene') === 'custom'
  $: adventure = normalizeAdventure({
    characterId: $page.url.searchParams.get('character'),
    episodeId: $page.url.searchParams.get('episode'),
    turns: Number($page.url.searchParams.get('turns')),
    revisit: $page.url.searchParams.get('revisit') === '1'
  })
  $: scene = adventure
    ? resolveScene('adventure', null, adventure)
    : isCustom
      ? resolveScene('custom', customScene)
      : findScene($page.url.searchParams.get('scene'))
  $: practiceId = $page.url.searchParams.get('practice')
  $: adminLogin = $page.url.searchParams.get('returnTo') === 'admin'
  async function login() {
    if (pending) return
    if (!auth || !provider) {
      message = 'ログインを初期化できませんでした。再読み込みしてお試しください。'
      return
    }
    pending = true
    message = ''
    try {
      let firebaseUser = auth.currentUser
      if (!firebaseUser) {
        const result = await signInWithPopup(auth, provider)
        firebaseUser = result.user
        await setAnalyticsUser(firebaseUser.uid)
        trackLogin(provider.providerId)
        if (getAdditionalUserInfo(result)?.isNewUser) trackSignup(provider.providerId)
      }
      await syncCurrentUserToApi(firebaseUser)
      if (adminLogin) await goto('/admin')
      else if (practiceId && /^[0-9a-f-]{36}$/i.test(practiceId))
        await goto(
          `/practice/${practiceId}${$page.url.searchParams.get('guest') === '1' ? '?guest=1' : ''}`
        )
      else if (scene) {
        const session = await startPractice(scene.id, isCustom ? customScene : null, adventure)
        await goto(`/practice/${session.id}`)
      } else {
        const destination = $page.url.searchParams.get('returnTo')
        if (destination === 'pricing') await goto(`/pricing${charactersForReturn()}`)
        else
          await goto(
            destination === 'tips'
              ? '/account/tips'
              : destination === 'memories'
                ? '/memories'
                : destination === 'account'
                  ? '/account'
                  : '/'
          )
      }
    } catch (error) {
      const code = (error as { code?: string }).code
      message =
        code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
          ? 'ログインを中断しました。選んだ場面はそのままです。'
          : code === 'auth/popup-blocked'
            ? 'ポップアップがブロックされました。このサイトのポップアップを許可して、もう一度お試しください。'
            : error instanceof Error && !code
              ? error.message
              : 'ログインできませんでした。もう一度お試しください。'
    } finally {
      pending = false
    }
  }
  function charactersForReturn() {
    const character = $page.url.searchParams.get('character')
    return ['aoi', 'rin', 'shiori', 'yu', 'sota', 'ren'].includes(character ?? '')
      ? `?character=${character}`
      : ''
  }
</script>

<svelte:head><title>Googleで始める | Koi-Tre</title></svelte:head>
<section class="login-card card">
  {#if adminLogin}
    <h1>管理者アカウントでログイン</h1>
  {:else}
    <p class="eyebrow">会話の続きを、ここから</p>
    <h1>準備ができたら、始めよう。</h1>
    <p>Googleアカウントで登録すると、<br />途中の会話や振り返りを保存できます。</p>
  {/if}
  {#if !adminLogin && practiceId && $page.url.searchParams.get('guest') === '1'}<p class="notice">
      第1話の体験を引き継ぎます。最初の返答の保存時に、毎月10枠のうち1枠を使用します。ログインをやり直しても二重に消費しません。
    </p>{/if}
  {#if !adminLogin && scene}<div class="selection">
      <span class="small muted">選んだ場面</span><strong>{scene.title}</strong><span
        class="partner-name">お相手：{scene.partnerName}さん（AI）</span
      ><span class="small"
        >{adventure?.turns ?? 3}回返答して振り返り・{adventure?.turns === 6
          ? '2'
          : '1'}枠使用・毎月10枠無料</span
      >
      {#if isCustom && customScene}<p class="custom-summary">{customScene.situation}</p>
        {#if customScene.openingLine}<p class="small">
            最初のひと言：{customScene.openingLine}
          </p>{/if}{/if}
    </div>{/if}<button
    class="button primary"
    on:click="{login}"
    disabled="{pending || (!adminLogin && isCustom && !scene && !practiceId)}"
    aria-busy="{pending}"
    >{pending
      ? '準備しています…'
      : adminLogin
        ? $user
          ? 'このアカウントで進む'
          : 'Googleでログイン'
        : $user
          ? '練習へ進む'
          : 'Googleで登録・ログイン'}</button
  >{#if message}<p class="error" role="alert">{message}</p>{/if}
  {#if !adminLogin && isCustom && !customDraftReady}<p role="status">
      場面の設定を読み込んでいます…
    </p>
  {:else if !adminLogin && isCustom && !scene}<p class="notice">
      カスタム場面の設定を読み込めませんでした。場面選択に戻って設定してください。
    </p>{/if}
  {#if adminLogin}
    <a href="/" class="text-link">トップに戻る</a>
  {:else}
    <p class="small muted">練習で名前・性別・年齢を入力する必要はありません。</p>
    <a
      href="{isCustom && $page.url.searchParams.get('preset') !== '1'
        ? '/#custom-scene'
        : '/#scenes'}"
      class="text-link">場面選択に戻る</a
    >
  {/if}
</section>

<style>
  .login-card {
    max-width: 32rem;
    margin: 3rem auto;
    padding: 2.5rem;
    text-align: center;
    width: 100%;
  }
  h1 {
    font-size: 1.7rem;
    font-family: var(--font-editorial);
    margin: 1rem 0;
  }
  p {
    line-height: 1.8;
  }
  .selection {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: #edf0e7;
    padding: 1rem;
    border-radius: 4px;
    margin: 1.5rem 0;
  }
  .button {
    margin: 1.5rem 0 0.5rem;
    width: 100%;
  }
  .text-link {
    display: inline-block;
    margin-top: 1rem;
  }
  .custom-summary {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    text-align: left;
    font-size: var(--text-sm);
    padding-top: 0.7rem;
    margin: 0.3rem 0 0;
    border-top: 1px solid var(--border);
  }
  @media (max-width: 500px) {
    .login-card {
      padding: 1.5rem;
      margin: 1.5rem 0;
    }
    h1 {
      font-size: 1.5rem;
    }
  }
</style>
