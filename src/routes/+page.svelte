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
  import welcome from '$lib/images/svelte-welcome.webp'
  import welcome_fallback from '$lib/images/svelte-welcome.png'
  import { onDestroy, onMount } from 'svelte'
  import { checkUsage } from '$lib/supabaseClient'

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

  onMount(() => {
    const handleClickOrEnter = () => {
      checkUsage(uid).then((result) => {
        if (result) {
          console.log('updateUsage checkUsage', result)
          usage.set(result)
        }
      })
      console.log('click checkUsage')
    }

    window.addEventListener('click', handleClickOrEnter)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleClickOrEnter()
      }
    })

    // Remove event listeners when the component is unmounted
    return () => {
      window.removeEventListener('click', handleClickOrEnter)
      window.removeEventListener('keydown', handleClickOrEnter)
    }
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
</script>

<svelte:head>
  <title>{import.meta.env.VITE_APP_TITLE} - HOME</title>
  <meta name="description" content="Koi-Treは、恋愛コミュニケーションスキルを向上させるための画期的なトレーニングプラットフォームです。実践的なシミュレーションを通じて、リアルな状況で使えるコミュニケーション技術を学びましょう！" />
</svelte:head>

<section>
  {#if !$user}
  <h1>
    <span class="welcome">
      <picture>
        <source srcset="{welcome}" type="image/webp" />
        <img src="{welcome_fallback}" alt="Welcome" />
      </picture>
    </span>
  </h1>
  {/if}

  {#if $user && isShowIframe}
    <p class="mb-4">こんにちは、{name}さん！</p>
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

    <div class="border border-gray-300 p-4 my-4 rounded">
      <p>今月の利用枠: あと{$usage}回</p>
    </div>

    <iframe
      id="koi-tre-iframe"
      title="Koi-Tre AI"
      src="https://udify.app/chatbot/Vu74gKYoYbIhoZRJ"
      style="width: 100%; height: 100%; min-height: 700px"
      frameborder="0"
      allow="microphone"
    >
    </iframe>
  {:else if !$user}
    <p class="mt-10"><a href="/login">ログイン</a>してください</p>
  {:else if !isShowIframe}
    <p class="mb-10">今月分の利用枠は無くなりました。</p>
    <div class="llm-text">
      <p>【最後の内容】</p>
      <div class="mkdwn border border-gray-300 p-4 my-4 rounded-lg bg-white">
        <SvelteMarkdown source="{$lastLlmText}" />
      </div>
    </div>
  {/if}
</section>

{#if $user}
<section class="survey-link text-center">
  <p>ご利用いただきありがとうございます。<br>サービス向上のため、アンケートにご協力いただけますと嬉しいです！</p>
  <a href="https://x.gd/49Btv" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-block mt-4">
    アンケートに答える
  </a>
</section>
{/if}

<style>
  /* TODO: マークダウンのスタイル
  .mkdwn {
  }
  */

  .toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    animation: fadeinout 3s;
  }

  @keyframes fadeinout {
    0%,
    100% {
      opacity: 0;
    }
    10%,
    90% {
      opacity: 1;
    }
  }

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
