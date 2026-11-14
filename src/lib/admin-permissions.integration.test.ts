import { describe, expect, it } from 'vitest'
import { writable } from 'svelte/store'
import { createAdminPermissionStore, type AdminPermission } from './admin-permissions'

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

describe('管理画面の表示権限', () => {
  it('未ログインでは取得せず、確認を終えた管理者だけを許可する', async () => {
    const users = writable<{ uid: string } | null>(null)
    let requests = 0
    const pending = deferred()
    const permission = createAdminPermissionStore(users, () => {
      requests++
      return pending.promise
    })
    let state: AdminPermission | undefined
    const stop = permission.subscribe((value) => {
      state = value
    })
    expect(requests).toBe(0)
    expect(state).toBe('signed-out')
    users.set({ uid: 'admin-fixture' })
    expect(state).toBe('checking')
    pending.resolve(true)
    await flush()
    expect(state).toBe('allowed')
    expect(requests).toBe(1)
    users.set(null)
    expect(state).toBe('signed-out')
    stop()
  })
  it('アカウント切替後に前の管理者の応答が届いても表示しない', async () => {
    const users = writable<{ uid: string } | null>({ uid: 'admin-fixture' })
    const requests = [deferred(), deferred()]
    let index = 0
    let state: AdminPermission | undefined
    const permission = createAdminPermissionStore(users, () => requests[index++].promise)
    const stop = permission.subscribe((value) => {
      state = value
    })
    users.set({ uid: 'member-fixture' })
    requests[1].resolve(false)
    await flush()
    requests[0].resolve(true)
    await flush()
    expect(state).toBe('denied')
    stop()
  })
  it('ログアウト後の遅い成功応答を表示しない', async () => {
    const users = writable<{ uid: string } | null>({ uid: 'admin-fixture' })
    const pending = deferred()
    let state: AdminPermission | undefined
    const stop = createAdminPermissionStore(users, () => pending.promise).subscribe((value) => {
      state = value
    })
    users.set(null)
    pending.resolve(true)
    await flush()
    expect(state).toBe('signed-out')
    stop()
  })
  it('取得失敗では隠し、再購読では古い応答を採用しない', async () => {
    const users = writable<{ uid: string } | null>({ uid: 'admin-fixture' })
    const requests = [deferred(), deferred()]
    let index = 0
    let state: AdminPermission | undefined
    const permission = createAdminPermissionStore(users, () => requests[index++].promise)
    const first = permission.subscribe((value) => {
      state = value
    })
    first()
    const second = permission.subscribe((value) => {
      state = value
    })
    requests[0].resolve(true)
    await flush()
    expect(state).toBe('checking')
    requests[1].reject(new Error('fixture network error'))
    await flush()
    expect(state).toBe('unavailable')
    second()
  })
})
