import { pathToFileURL } from 'node:url'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

const functionRoot = path.resolve('.vercel/output/functions/![-]/catchall.func')
const manifestFile = '.svelte-kit/vercel-tmp/manifest.js'
// ローカルビルドではアダプターが作業ディレクトリを関数内に保持する場合がある。
const directManifest = path.join(functionRoot, manifestFile)
const tracedManifests = existsSync(directManifest)
  ? [manifestFile]
  : readdirSync(functionRoot, { recursive: true }).filter((file) => file.endsWith(`/${manifestFile}`))
if (tracedManifests.length !== 1) throw new Error('Vercelのcatchallのmanifestを一意に特定できません。')
const manifestPath = path.join(functionRoot, tracedManifests[0])
const { manifest } = await import(pathToFileURL(manifestPath).href)

// Kit 2.17の404処理はroot layout/errorを使う。空のcatchallでは通常の404まで500になる。
if (typeof manifest._.nodes[0] !== 'function' || typeof manifest._.nodes[1] !== 'function') {
  throw new Error(
    'Vercelのcatchallに404画面のlayout/errorが含まれていません。関数分割設定を確認してください。'
  )
}

console.log('Vercelの404画面のビルドを確認しました。')
