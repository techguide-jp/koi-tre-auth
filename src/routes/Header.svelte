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
  <a class="brand" href="/" aria-label="Koi-Tre ホーム"
    ><span class="brand-mark" aria-hidden="true">k.</span><span
      >Koi-Tre<span class="brand-caption">会話の小さな練習室</span></span
    ></a
  >
  <nav aria-label="メインメニュー">
    <a href="/about">使い方</a><a href="/contact">お問い合わせ</a>{#if $user}<button
        class="logout"
        disabled="{pending}"
        aria-busy="{pending}"
        on:click="{logout}">{pending ? 'ログアウト中…' : 'ログアウト'}</button
      >{:else}<a class="login-link" href="/login">ログイン</a>{/if}
  </nav>
</header>
{#if message}<p class="error" role="alert">{message}</p>{/if}

<style>
  header {
    max-width: 72rem;
    margin: 0 auto;
    width: 100%;
    padding: 1.35rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    box-sizing: border-box;
    border-bottom: 1px solid var(--border);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: var(--ink);
    font-size: 1.3rem;
    font-weight: 750;
    letter-spacing: -0.03em;
  }
  .brand:hover {
    text-decoration: none;
  }
  .brand-mark {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.8rem;
    background: var(--accent);
    color: white;
    font-family: Georgia, serif;
    font-size: 1.65rem;
  }
  .brand-caption {
    display: block;
    font-size: 0.55rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  nav {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    font-size: 0.8rem;
  }
  nav a {
    color: var(--ink);
  }
  .login-link,
  .logout {
    border: 1px solid var(--border);
    padding: 0.55rem 0.9rem;
    border-radius: 2rem;
    background: white;
    font-size: 0.8rem;
  }
  .logout {
    cursor: pointer;
  }
  @media (max-width: 550px) {
    header {
      padding: 1rem;
      gap: 0.5rem;
    }
    nav {
      gap: 0.65rem;
      font-size: 0.7rem;
    }
    .brand-caption {
      display: none;
    }
    .brand {
      font-size: 1.05rem;
      gap: 0.4rem;
    }
    .brand-mark {
      width: 2rem;
      height: 2rem;
    }
    nav .login-link,
    nav .logout {
      padding: 0.45rem 0.6rem;
      font-size: 0.7rem;
    }
  }
</style>
