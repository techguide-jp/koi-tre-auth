<script lang="ts">
  import { auth } from '$lib/firebaseConfig'
  import { signOut } from 'firebase/auth'
  import { user } from '$lib/stores'
  let pending = false
  let message = ''
  async function logout() {
    if (!auth || pending) return
    pending = true
    message = ''
    try {
      await signOut(auth)
    } catch {
      message = 'ログアウトできませんでした。もう一度お試しください。'
    } finally {
      pending = false
    }
  }
</script>

<header>
  <a class="brand" href="/" aria-label="Koi-Tre コイトレ ホーム"
    ><svg class="brand-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true"
      ><path
        d="M7 6h20a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H17l-8 5v-5H7a5 5 0 0 1-5-5V11a5 5 0 0 1 5-5Z"
        stroke="currentColor"
        stroke-width="1.8"
      ></path><path
        d="M11 13v9m0-3 7-6m-6 5 7 5"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      ></path><circle cx="25" cy="22" r="1.2" fill="currentColor"></circle></svg
    ><span class="brand-name">Koi-Tre<span class="brand-kana">コイトレ</span></span></a
  >
  <nav aria-label="メインメニュー">
    <a href="/topics">会話ネタ帳</a>
    <a href="/try">30秒お試し</a><a class="contact-link" href="/about">使い方</a>{#if $user}<button
        class="logout"
        disabled="{pending}"
        aria-busy="{pending}"
        on:click="{logout}">{pending ? 'ログアウト中…' : 'ログアウト'}</button
      >{:else}<a class="login-link" href="/login">ログイン<span aria-hidden="true"> →</span></a
      >{/if}
  </nav>
</header>
{#if message}<p class="error" role="alert">{message}</p>{/if}

<style>
  header {
    max-width: 72rem;
    margin: 0 auto;
    width: 100%;
    padding: 1.45rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    border-bottom: 1px solid var(--border);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--ink);
  }
  .brand:hover {
    text-decoration: none;
  }
  .brand-mark {
    width: 2.2rem;
    height: 2.2rem;
    color: var(--accent);
  }
  .brand-name {
    font-family: Georgia, serif;
    font-weight: 600;
    font-size: 1.7rem;
    letter-spacing: -0.045em;
    line-height: 1;
  }
  .brand-kana {
    display: block;
    font-family: var(--font-body);
    font-weight: 400;
    font-size: 0.5rem;
    text-align: center;
    margin-top: 0.45rem;
    letter-spacing: 0.2em;
    color: var(--muted);
  }
  nav {
    display: flex;
    align-items: center;
    gap: 1.8rem;
    font-size: 0.75rem;
  }
  nav a {
    color: var(--ink);
  }
  .login-link,
  .logout {
    border: 1px solid #b9beb1;
    padding: 0.65rem 1rem;
    border-radius: 3px;
    background: transparent;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--ink);
  }
  @media (max-width: 700px) {
    header {
      padding: 1.1rem 1.25rem;
    }
    nav {
      gap: 1rem;
      font-size: 0.7rem;
    }
    .brand-name {
      font-size: 1.4rem;
    }
    .brand-mark {
      width: 1.8rem;
      height: 1.8rem;
    }
    .brand-kana {
      font-size: 0.45rem;
    }
    .contact-link {
      display: none;
    }
    .login-link,
    .logout {
      padding: 0.6rem 0.7rem;
      font-size: 0.7rem;
    }
  }
</style>
