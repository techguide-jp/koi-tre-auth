import assert from 'node:assert/strict'

// HTTPで取得したHTMLを確認し、JS実行後だけSEO情報が現れる回帰も検出する。
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5184')
const origin = 'https://app.koi-tre.com'
async function read(path) {
  const response = await fetch(new URL(path, base))
  return { response, html: await response.text() }
}
const { response, html: sitemap } = await read('/sitemap.xml')
assert.equal(response.status, 200, 'サイトマップを取得できる')
assert.match(response.headers.get('content-type'), /(?:application|text)\/xml/)
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]))
assert.ok(urls.length >= 12, '公開入口がサイトマップにある')
for (const path of [
  '/share',
  '/try',
  '/pricing',
  '/guides/matching-app-phone-topics',
  '/guides/second-date-conversation'
]) {
  assert.ok(
    urls.some((url) => url.pathname === path),
    `${path} がサイトマップにある`
  )
}
assert.equal(new Set(urls.map(String)).size, urls.length, 'サイトマップに重複がない')
const titles = new Set()
for (const url of urls) {
  assert.equal(url.origin, origin)
  assert.equal(url.search, '')
  assert.doesNotMatch(url.pathname, /^\/(api|login|practice|counter|sverdle)(\/|$)/)
  const { response, html } = await read(url.pathname)
  assert.equal(response.status, 200, url.pathname)
  assert.equal((html.match(/<title>/g) ?? []).length, 1, `${url.pathname} titleの重複なし`)
  assert.equal(
    (html.match(/name="description"/g) ?? []).length,
    1,
    `${url.pathname} descriptionの重複なし`
  )
  assert.ok(html.includes(`rel="canonical" href="${url.href}"`), `${url.pathname} canonical`)
  assert.match(html, /name="robots" content="index,follow"/)
  assert.ok(html.includes(`property="og:url" content="${url.href}"`))
  assert.match(html, /name="twitter:card" content="summary_large_image"/)
  assert.ok(!response.headers.get('x-robots-tag')?.includes('noindex'), `${url.pathname} 公開可`)
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1]
  assert.ok(title && !titles.has(title), `${url.pathname} 固有のtitle`)
  titles.add(title)
}
for (const path of [
  '/login?scene=cafe',
  '/memories',
  '/account',
  '/practice/00000000-0000-0000-0000-000000000000',
  '/counter',
  '/sverdle',
  '/missing-seo-check',
  '/guides/missing-seo-check'
]) {
  const { response, html } = await read(path)
  assert.match(html, /name="robots" content="noindex,follow"/, path)
  assert.doesNotMatch(html, /rel="canonical"|property="og:url"/, path)
  if (path.includes('missing-seo-check')) assert.equal(response.status, 404, path)
}
for (const path of [
  '/admin',
  '/admin/users',
  '/admin/billing',
  '/admin/usage',
  '/admin/knowledge',
  '/admin/characters',
  '/%61dmin'
]) {
  const { response, html } = await read(path)
  assert.equal(response.status, 200, path)
  assert.match(html, /アクセス権限を確認しています/, path)
  assert.doesNotMatch(html, /aria-label="管理者モード"|<h1[^>]*>/, path)
  assert.match(html, /name="robots" content="noindex,follow"/, path)
}
const { html: robots } = await read('/robots.txt')
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
console.log(
  `公開${urls.length}ページのSSRメタデータ・サイトマップ・非公開/404のnoindex・管理画面の初期表示を確認しました。`
)
