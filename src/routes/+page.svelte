<script context="module" lang="ts">
  import { auth } from '$lib/firebaseConfig'
  import { goto } from '$app/navigation'
  import { user, usage, usageChannel, lastLlmText } from '$lib/stores'
  import SvelteMarkdown from 'svelte-markdown'

  export async function load() {
    return new Promise((resolve) => {
      auth.onAuthStateChanged((user) => {
        if (!user) {
          goto('/login')
        } else {
          resolve({})
        }
      })
    })
  }
</script>

<script lang="ts">
  import GoogleLoginButton from '$lib/components/GoogleLoginButton.svelte'
  import welcome from '$lib/images/svelte-welcome.webp'
  import welcome_fallback from '$lib/images/svelte-welcome.png'
  import { onDestroy, onMount } from 'svelte'
  import { checkUsage } from '$lib/supabaseClient'
  import { writable } from 'svelte/store'

  $: isShowIframe = $usage > 0

  // userにセットされたuidを取得
  let uid: string = ''
  let name: string = ''
  user.subscribe((value) => {
    if (value != null) {
      uid = value.uid || ''
      name = value.displayName || 'ななし'
    }
  })
  let toastMessage = '' // 通知メッセージ
  let isShowToastMessage = false // 通知を表示するかどうかのフラグ
  let recoveryTime = writable('') // 回復時間
  let isMounted = false

  onMount(() => {
    const handleClickOrEnter = async () => {
      const result = await checkUsage(uid)
      if (result) {
        console.log('updateUsage checkUsage', result)
        usage.set(result)
      }
      console.log('click checkUsage')
    }

    window.addEventListener('click', handleClickOrEnter)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleClickOrEnter()
      }
    })
    calculateRecoveryTime();
    const interval = setInterval(calculateRecoveryTime, 1);

    handleClickOrEnter().then(() => {
      isMounted = true
      // Remove event listeners when the component is unmounted
      return () => {
        window.removeEventListener('click', handleClickOrEnter)
        window.removeEventListener('keydown', handleClickOrEnter)
        clearInterval(interval)
      }
    })
  })

  onDestroy(() => {
    // コンポーネント破棄時に購読を解除
    usageChannel.subscribe((value) => {
      if (value) {
        console.log('onDestroy usageChannel', value)
        value.unsubscribe()
      }
    })
  })

  function copyToClipboard() {
    navigator.clipboard
      .writeText(uid)
      .then(() => {
        toastMessage = 'IDがコピーされました！'
        isShowToastMessage = true // メッセージを表示
        setTimeout(() => {
          isShowToastMessage = false // 3秒後にメッセージを非表示
        }, 3000)
      })
      .catch((err) => {
        console.error('コピーに失敗しました: ', err)
        toastMessage = 'コピーに失敗しました。'
        isShowToastMessage = true
        setTimeout(() => {
          isShowToastMessage = false
        }, 3000)
      })
  }

  function calculateRecoveryTime() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = nextMonth.getTime() - now.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const milliseconds = (diff % 100).toString().padStart(2, '0');

    recoveryTime.set(`${days}日 ${hours}時間 ${minutes}分 ${seconds}.${milliseconds}秒`);
  }
</script>

<svelte:head>
  <title>{import.meta.env.VITE_APP_TITLE} - 恋愛コミュニケーションスキル向上プラットフォーム</title>
  <meta name="description" content="Koi-Treは、恋愛コミュニケーションスキルを向上させるための画期的なトレーニングプラットフォームです。実践的なシミュレーションを通じて、リアルな状況で使えるコミュニケーション技術を学びましょう！" />
  <meta name="keywords" content="恋愛, コミュニケーション, スキル, トレーニング, シミュレーション, 恋愛スキル, コミュニケーション技術, 恋愛コミュニケーション, Koi-Tre" />
  <meta name="author" content="TechGuide LLC." />
  <meta property="og:title" content="{import.meta.env.VITE_APP_TITLE} - 恋愛コミュニケーションスキル向上プラットフォーム" />
  <meta property="og:description" content="Koi-Treは、恋愛コミュニケーションスキルを向上させるための画期的なトレーニングプラットフォームです。実践的なシミュレーションを通じて、リアルな状況で使えるコミュニケーション技術を学びましょう！" />
  <!--<meta property="og:image" content="/path/to/your/image.jpg" />-->
  <meta property="og:url" content="https://www.koi-tre.com" />
  <!--<meta name="twitter:card" content="summary_large_image" />-->
  <meta name="twitter:title" content="{import.meta.env.VITE_APP_TITLE} - 恋愛コミュニケーションスキル向上プラットフォーム" />
  <meta name="twitter:description" content="Koi-Treは、恋愛コミュニケーションスキルを向上させるための画期的なトレーニングプラットフォームです。実践的なシミュレーションを通じて、リアルな状況で使えるコミュニケーション技術を学びましょう！" />
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
    {/if}

    {#if $user && isShowIframe}
      <p class="mb-4">こんにちは、{name}さん！</p>
      <div class="border border-gray-300 p-4 my-4 rounded">
        <p>今月の利用枠: あと{$usage}回</p>
      </div>

      <iframe
        id="koi-tre-iframe"
        title="Koi-Tre AI"
        src="https://udify.app/chatbot/Vu74gKYoYbIhoZRJ"
        style="width: 100%; height: 100%; min-height: 600px"
        frameborder="0"
        allow="microphone"
      >
      </iframe>
      <div class="flex flex-col items-start">
        <p class="mb-2">あなたのID:</p>
        <p class="border border-gray-300 p-2 mb-2">{uid}</p>
        <button
          on:click="{copyToClipboard}"
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-2 mx-auto block"
        >
          コピー
        </button>
        {#if isShowToastMessage}
          <div class="toast">{toastMessage}</div>
        {/if}
      </div>

    {:else if !$user}
      <div class="mt-10 text-center">
        <GoogleLoginButton />
        <br>
        <p class="mt-4 text-lg text-gray-700 font-semibold">
          ※ 利用回数を計測するため、登録が必要となっております。
        </p>
        <p class="mt-2 text-sm text-gray-600">
          登録することで、月ごとの利用回数を管理し、より良いサービスを提供することができます。
        </p>
      </div>
    {:else if !isShowIframe}
      <p class="mb-10 text-center">今月分の利用枠は無くなりました。<br><br>利用回数回復まで残り時間<br>{$recoveryTime}</p>
      <div class="llm-text">
        <p>【最後の内容】</p>
        <div class="mkdwn border border-gray-300 p-4 my-4 rounded-lg bg-white">
          <SvelteMarkdown source="{$lastLlmText}" />
        </div>
      </div>
    {/if}
  </section>

  {#if $user}
  <hr class="my-6">
  <section class="survey-link text-center mt-6">
    <p>ご利用いただきありがとうございます。<br>サービス向上のため、アンケートにご協力いただけますと嬉しいです！</p>
    <a href="https://x.gd/49Btv" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-block mt-4">
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
