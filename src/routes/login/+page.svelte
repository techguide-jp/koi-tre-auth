<script lang="ts" context="module">
  import { signInWithPopup } from 'firebase/auth'
  import { auth, provider } from '$lib/firebaseConfig'
  import { goto } from '$app/navigation'
  import { trackLogin } from '$lib/analytics'

  async function login() {
    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      console.log('Logged in user:', user) // ログインしたユーザーの情報を表示

      // ログイン方法をトラッキング
      trackLogin(provider.providerId)

      // ログイン後のリダイレクト（ホームページなどに遷移する場合）
      goto('/')
    } catch (error) {
      console.error('Login failed:', error)
    }
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte'

  let toastMessage = '' // 通知メッセージ
  $: isShowToastMessage = !!toastMessage // メッセージを表示

  function resetToastMessage() {
    setTimeout(() => {
      toastMessage = ''
    }, 3000)
  }

  onMount(() => {
    signInWithPopup(auth, provider)
      .then(() => {
        goto('/') // ログイン成功後、メインページにリダイレクト
      })
      .catch((error) => {
        console.error('Login failed:', error)
        toastMessage = 'ログインに失敗しました。もう一度お試しください。'
        resetToastMessage()
      })
  })
</script>

<div class="login-container">
  <button class="login-button" on:click="{login}">Login with Google</button>
  {#if isShowToastMessage}
    <div class="toast">{toastMessage}</div>
  {/if}
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f3f4f6;
  }

  .login-button {
    padding: 10px 20px;
    font-size: 16px;
    color: white;
    background-color: #4285f4;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }
</style>
