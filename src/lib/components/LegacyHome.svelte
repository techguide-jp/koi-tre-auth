<script lang="ts">
  import GoogleLoginButton from '$lib/components/GoogleLoginButton.svelte'
  import welcome from '$lib/images/svelte-welcome.webp'
  import welcome_fallback from '$lib/images/svelte-welcome.png'
  import SvelteMarkdown from 'svelte-markdown'
  import { onMount } from 'svelte'
  import { getNextTokyoMonthStart } from '$lib/utils/tokyo-month'
  import {
    dashboardError,
    dashboardLoaded,
    fetchDifyAccessKey,
    lastLlmText,
    refreshDashboard,
    startDashboardPolling,
    usage,
    usageLimit,
    user
  } from '$lib/stores'

  $: isShowIframe = $usage > 0

  let name: string = ''
  $: name = $user?.displayName ?? 'ななし'

  let toastMessage = ''
  let isShowToastMessage = false
  let recoveryTime = ''
  let isMounted = false

  onMount(() => {
    const stopPolling = startDashboardPolling()
    const recoveryInterval = window.setInterval(calculateRecoveryTime, 1000)

    const handleFocus = () => {
      void refreshDashboard()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshDashboard()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    calculateRecoveryTime()
    isMounted = true

    return () => {
      stopPolling()
      window.clearInterval(recoveryInterval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  async function copyToClipboard() {
    try {
      const { accessKey } = await fetchDifyAccessKey()
      await navigator.clipboard.writeText(accessKey)
      toastMessage = 'アクセスキーがコピーされました！'
      isShowToastMessage = true
      setTimeout(() => {
        isShowToastMessage = false
      }, 3000)
    } catch (err) {
      console.error('コピーに失敗しました: ', err)
      toastMessage = 'アクセスキーのコピーに失敗しました。再度お試しください。'
      isShowToastMessage = true
      setTimeout(() => {
        isShowToastMessage = false
      }, 3000)
    }
  }

  function calculateRecoveryTime() {
    const now = new Date()
    const nextMonth = getNextTokyoMonthStart(now)
    const diff = nextMonth.getTime() - now.getTime()

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    const milliseconds = (diff % 100).toString().padStart(2, '0')

    recoveryTime = `${days}日 ${hours}時間 ${minutes}分 ${seconds}.${milliseconds}秒`
  }
</script>

<svelte:head>
  <title>{import.meta.env.VITE_APP_TITLE} - 恋愛コミュニケーションスキル向上プラットフォーム</title>
  <meta
    name="description"
    content="Koi-Treは、恋愛コミュニケーションスキルを向上させるための画期的なトレーニングプラットフォームです。実践的なシミュレーションを通じて、リアルな状況で使えるコミュニケーション技術を学びましょう！"
  />
  <meta
    name="keywords"
    content="恋愛, コミュニケーション, スキル, トレーニング, シミュレーション, 恋愛スキル, コミュニケーション技術, 恋愛コミュニケーション, Koi-Tre"
  />
  <meta name="author" content="TechGuide LLC." />
  <meta
    property="og:title"
    content="{import.meta.env.VITE_APP_TITLE} - 恋愛コミュニケーションスキル向上プラットフォーム"
  />
  <meta
    property="og:description"
    content="Koi-Treは、恋愛コミュニケーションスキルを向上させるための画期的なトレーニングプラットフォームです。実践的なシミュレーションを通じて、リアルな状況で使えるコミュニケーション技術を学びましょう！"
  />
  <!--<meta property="og:image" content="/path/to/your/image.jpg" />-->
  <meta property="og:url" content="https://www.koi-tre.com" />
  <!--<meta name="twitter:card" content="summary_large_image" />-->
  <meta
    name="twitter:title"
    content="{import.meta.env.VITE_APP_TITLE} - 恋愛コミュニケーションスキル向上プラットフォーム"
  />
  <meta
    name="twitter:description"
    content="Koi-Treは、恋愛コミュニケーションスキルを向上させるための画期的なトレーニングプラットフォームです。実践的なシミュレーションを通じて、リアルな状況で使えるコミュニケーション技術を学びましょう！"
  />
  <!--<meta name="twitter:image" content="/path/to/your/image.jpg" />-->
</svelte:head>

{#if isMounted}
  <section>
    {#if !$user}
      <h1>
        <span class="welcome">
          <picture>
            <source srcset="{welcome}" type="image/webp" />
            <img src="{welcome_fallback}" alt="Koi-Treへようこそ" />
          </picture>
        </span>
      </h1>

      <div class="mt-10 text-center">
        <GoogleLoginButton />
        <br />
        <p class="mt-4 text-lg text-gray-700 font-semibold">
          ※ 利用回数を計測するため、登録が必要となっております。
        </p>
        <p class="mt-2 text-sm text-gray-600">
          登録することで、月ごとの利用回数を管理し、より良いサービスを提供することができます。
        </p>
      </div>
    {:else if !$dashboardLoaded && !$dashboardError}
      <p class="mb-4">利用状況を読み込んでいます...</p>
    {:else if $dashboardError}
      <div class="border border-red-300 bg-red-50 text-red-700 p-4 my-4 rounded">
        <p>{$dashboardError}</p>
        <button
          on:click="{() => void refreshDashboard()}"
          class="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          再取得する
        </button>
      </div>
    {:else if isShowIframe}
      <p class="mb-4">こんにちは、{name}さん！</p>
      <div class="border border-gray-300 p-4 my-4 rounded">
        <p>今月の利用枠: あと{$usage}回 / {$usageLimit}回</p>
      </div>

      <iframe
        id="koi-tre-iframe"
        title="Koi-Tre AI"
        src="https://udify.app/chatbot/ZrXKolzGVqqV9lYI"
        style="width: 100%; height: 100%; min-height: 600px"
        frameborder="0"
        allow="microphone"
      >
      </iframe>
      <div class="flex flex-col items-start">
        <button
          on:click="{copyToClipboard}"
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-2 mx-auto block"
        >
          アクセスキーをコピー
        </button>
        {#if isShowToastMessage}
          <div class="toast">{toastMessage}</div>
        {/if}
      </div>
    {:else}
      <p class="mb-10 text-center">
        今月分の利用枠は無くなりました。<br /><br />利用回数回復まで残り時間<br />{recoveryTime}
      </p>
      <div class="llm-text">
        <p>【最後の内容】</p>
        <div class="mkdwn border border-gray-300 p-4 my-4 rounded-lg bg-white">
          <SvelteMarkdown source="{$lastLlmText}" />
        </div>
      </div>
    {/if}
  </section>

  {#if $user}
    <hr class="my-6" />
    <section class="survey-link text-center mt-6">
      <p>
        ご利用いただきありがとうございます。<br
        />サービス向上のため、アンケートにご協力いただけますと嬉しいです！
      </p>
      <a
        href="https://x.gd/49Btv"
        class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-block mt-4"
      >
        アンケートに答える
      </a>
    </section>
  {/if}
{/if}

<style>
  /* TODO: マークダウンのスタイル
  .mkdwn {
  }
  */

  /* 以下は元のコードのスタイル */
  section {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    flex: 0.6;
  }

  h1 {
    width: 100%;
  }

  .welcome {
    display: block;
    position: relative;
    width: 100%;
    height: 0;
    padding: 0 0 calc(100% * 495 / 2048) 0;
  }

  .welcome img {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    display: block;
  }
</style>
