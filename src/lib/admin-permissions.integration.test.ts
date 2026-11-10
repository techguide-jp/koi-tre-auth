import { describe, expect, it } from 'vitest'
import { writable } from 'svelte/store'
import { createAdminPermissionStore } from './admin-permissions'

function deferred() {
  let resolve!: (value: boolean) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<boolean>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('ヘッダーの管理リンク', () => {
  it('未ログインでは取得せず、取得成功の管理者だけに表示する', async () => {
    const users = writable<{ uid: string } | null>(null)
    let requests = 0
    const pending = deferred()
    const permission = createAdminPermissionStore(users, () => {
      requests++
      return pending.promise
    })
    let visible = false
    const stop = permission.subscribe((value) => {
      visible = value
    })
    expect(requests).toBe(0)
    users.set({ uid: 'admin-fixture' })
    expect(visible).toBe(false)
    pending.resolve(true)
    await flush()
    expect(visible).toBe(true)
    expect(requests).toBe(1)
    users.set(null)
    expect(visible).toBe(false)
    stop()
  })
  it('アカウント切替後に前の管理者の応答が届いても表示しない', async () => {
    const users = writable<{ uid: string } | null>({ uid: 'admin-fixture' })
    const requests = [deferred(), deferred()]
    let index = 0,
      visible = false
    const permission = createAdminPermissionStore(users, () => requests[index++].promise)
    const stop = permission.subscribe((value) => {
      visible = value
    })
    users.set({ uid: 'member-fixture' })
    requests[1].resolve(false)
    await flush()
    requests[0].resolve(true)
    await flush()
    expect(visible).toBe(false)
    stop()
  })
  it('ログアウト後の遅い成功応答を表示しない', async () => {
    const users = writable<{ uid: string } | null>({ uid: 'admin-fixture' })
    const pending = deferred()
    let visible = false
    const stop = createAdminPermissionStore(users, () => pending.promise).subscribe((value) => {
      visible = value
    })
    users.set(null)
    pending.resolve(true)
    await flush()
    expect(visible).toBe(false)
    stop()
  })
  it('取得失敗では隠し、再購読では古い応答を採用しない', async () => {
    const users = writable<{ uid: string } | null>({ uid: 'admin-fixture' })
    const requests = [deferred(), deferred()]
    let index = 0,
      visible = false
    const permission = createAdminPermissionStore(users, () => requests[index++].promise)
    const first = permission.subscribe((value) => {
      visible = value
    })
    first()
    const second = permission.subscribe((value) => {
      visible = value
    })
    requests[0].resolve(true)
    await flush()
    expect(visible).toBe(false)
    requests[1].reject(new Error('fixture network error'))
    await flush()
    expect(visible).toBe(false)
    second()
  })
})
