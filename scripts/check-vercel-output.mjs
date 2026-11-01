import { pathToFileURL } from 'node:url'
import path from 'node:path'

const manifestPath = path.resolve(
  '.vercel/output/functions/![-]/catchall.func/.svelte-kit/vercel-tmp/manifest.js'
)
const { manifest } = await import(pathToFileURL(manifestPath).href)

// Kit 2.17の404処理はroot layout/errorを使う。空のcatchallでは通常の404まで500になる。
if (typeof manifest._.nodes[0] !== 'function' || typeof manifest._.nodes[1] !== 'function') {
  throw new Error(
    'Vercelのcatchallに404画面のlayout/errorが含まれていません。関数分割設定を確認してください。'
  )
}

console.log('Vercelの404画面のビルドを確認しました。')
