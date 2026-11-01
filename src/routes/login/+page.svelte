<script lang="ts">
  import { getAdditionalUserInfo, signInWithPopup } from 'firebase/auth'
  import { auth, provider } from '$lib/firebaseConfig'
  import { goto } from '$app/navigation'
  import { setAnalyticsUser, trackLogin, trackSignup } from '$lib/analytics'
  import { onMount } from 'svelte'

  let toastMessage = '' // 通知メッセージ
  let isLoggingIn = false
  $: isShowToastMessage = !!toastMessage // メッセージを表示

  async function login() {
    if (isLoggingIn) return
    if (!auth || !provider) {
      toastMessage = 'この環境ではログインを初期化できませんでした。'
      resetToastMessage()
      return
    }

    isLoggingIn = true
    toastMessage = ''
    try {
      const result = await signInWithPopup(auth, provider)
      await setAnalyticsUser(result.user.uid)
      trackLogin(provider.providerId)
      if (getAdditionalUserInfo(result)?.isNewUser) trackSignup(provider.providerId)

      await goto('/')
    } catch (error) {
      console.error('Login failed:', error)
      toastMessage = 'ログインに失敗しました。もう一度お試しください。'
      resetToastMessage()
    } finally {
      isLoggingIn = false
    }
  }

  function resetToastMessage() {
    setTimeout(() => {
      toastMessage = ''
    }, 3000)
  }

  onMount(() => {
    void login()
  })
</script>

<div class="login-container">
  <button
    class="login-button"
    on:click="{login}"
    disabled="{isLoggingIn}"
    aria-busy="{isLoggingIn}"
  >
    {isLoggingIn ? 'ログイン中...' : 'Login with Google'}
  </button>
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
