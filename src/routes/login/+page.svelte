<script lang="ts">
  import { getAdditionalUserInfo, signInWithPopup } from 'firebase/auth'
  import { auth, provider } from '$lib/firebaseConfig'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { findScene } from '$lib/practice'
  import { startPractice } from '$lib/practice-client'
  import { syncCurrentUserToApi, user } from '$lib/stores'
  import { setAnalyticsUser, trackLogin, trackSignup } from '$lib/analytics'
  let message = ''
  let pending = false
  $: scene = findScene($page.url.searchParams.get('scene'))
  $: practiceId = $page.url.searchParams.get('practice')
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
      if (practiceId && /^[0-9a-f-]{36}$/i.test(practiceId)) await goto(`/practice/${practiceId}`)
      else if (scene) {
        const session = await startPractice(scene.id)
        await goto(`/practice/${session.id}`)
      } else await goto('/')
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
</script>

<svelte:head><title>Googleで始める | Koi-Tre</title></svelte:head>
<section class="login-card card">
  <p class="eyebrow">YOUR FIRST STEP</p>
  <h1>練習の準備は、これだけ。</h1>
  <p>Googleアカウントで登録すると、<br />途中の会話や振り返りを保存できます。</p>
  {#if scene}<div class="selection">
      <span class="small muted">選んだ場面</span><strong>{scene.title}</strong><span class="small"
        >3回返答して振り返り・月10回無料</span
      >
    </div>{/if}<button
    class="button primary"
    on:click="{login}"
    disabled="{pending}"
    aria-busy="{pending}"
    >{pending ? '準備しています…' : $user ? '練習へ進む' : 'Googleで登録・ログイン'}</button
  >{#if message}<p class="error" role="alert">{message}</p>{/if}
  <p class="small muted">練習で名前・性別・年齢を入力する必要はありません。</p>
  <a href="/" class="text-link">場面選択に戻る</a>
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
    font-size: 1.8rem;
    margin: 1rem 0;
  }
  p {
    line-height: 1.8;
  }
  .selection {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: #f5f2ee;
    padding: 1rem;
    border-radius: 1rem;
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
