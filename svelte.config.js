import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // Vercel の Node.js 24 とビルド用アダプターの対応を固定する。
    // Kit 2.17では関数分割時の空catchallに404画面が含まれないため、実行時間を統一する。
    adapter: adapter({ runtime: 'nodejs24.x', maxDuration: 65 })
  }
}

export default config
