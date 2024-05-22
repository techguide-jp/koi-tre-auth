<script lang="ts">
  import { page } from '$app/stores'
  import { auth } from '$lib/firebaseConfig'
  import { signOut } from 'firebase/auth'
  import logo from '$lib/images/logo.svg'
  import { user } from '$lib/stores' // Assuming there's a user store to manage authentication state
  import { goto } from '$app/navigation'
  import Menu from '@smui/menu'
  import List, { Item, Separator, Text } from '@smui/list'
  import Button, { Label } from '@smui/button'

  let menu: Menu

  async function logout() {
    try {
      await signOut(auth)
      user.set(null)
      console.log('Logged out successfully')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }
</script>

<header>
  <div class="corner">
    <a href="{import.meta.env.VITE_APP_DOMAIN}">
      <img src="{logo}" alt="SvelteKit" />
    </a>
  </div>

  <nav>
    <svg viewBox="0 0 2 3" aria-hidden="true">
      <path d="M0,0 L1,2 C1.5,3 1.5,3 2,3 L2,0 Z"></path>
    </svg>
    <ul>
      <li aria-current="{$page.url.pathname === '/' ? 'page' : undefined}">
        <a href="/">Home</a>
      </li>
      <li aria-current="{$page.url.pathname === '/about' ? 'page' : undefined}">
        <a href="https://www.koi-tre.com/">About</a>
      </li>
      <li aria-current="{$page.url.pathname === '/contact' ? 'page' : undefined}">
        <a href="/contact">Contact</a>
      </li>
    </ul>
    <svg viewBox="0 0 2 3" aria-hidden="true">
      <path d="M0,0 L0,3 C0.5,3 0.5,3 1,2 L2,0 Z"></path>
    </svg>
  </nav>

  <!-- right menu -->
  <div>
    {#if $user}
      <div style="min-width: 100px;">
        <Button on:click="{() => menu.setOpen(true)}">
          <Label>Open Menu</Label>
        </Button>
        <Menu bind:this="{menu}">
          <List>
            <Separator />
            <Item on:SMUI:action="{() => logout()}">
              <Text>Logout</Text>
            </Item>
          </List>
        </Menu>
      </div>
    {:else}
      <button
        on:click="{() => goto('/login')}"
        class="text-primary font-bold py-2 px-4 rounded"
        style="flex: 1; padding-left: 10px;">Login</button
      >
    {/if}
  </div>
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
  }

  .corner {
    width: 3em;
    height: 3em;
    position: relative;
  }

  .corner a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .corner img {
    width: 2em;
    height: 2em;
    object-fit: contain;
  }

  nav {
    display: flex;
    justify-content: center;
    --background: rgba(255, 255, 255, 0.7);
  }

  svg {
    width: 2em;
    height: 3em;
    display: block;
  }

  path {
    fill: var(--background);
  }

  ul {
    position: relative;
    padding: 0;
    margin: 0;
    height: 3em;
    display: flex;
    justify-content: center;
    align-items: center;
    list-style: none;
    background: var(--background);
    background-size: contain;
  }

  li {
    position: relative;
    height: 100%;
  }

  li[aria-current='page']::before {
    --size: 6px;
    content: '';
    width: 0;
    height: 0;
    position: absolute;
    top: 0;
    left: calc(50% - var(--size));
    border: var(--size) solid transparent;
    border-top: var(--size) solid var(--color-theme-1);
  }

  nav a {
    display: flex;
    height: 100%;
    align-items: center;
    padding: 0 0.5rem;
    color: var(--color-text);
    font-weight: 700;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-decoration: none;
    transition: color 0.2s linear;
  }

  a:hover {
    color: var(--color-theme-1);
  }
</style>
