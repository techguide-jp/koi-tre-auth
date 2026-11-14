import { readable, type Readable } from 'svelte/store'

type PermissionUser = { uid: string } | null
export type AdminPermission = 'signed-out' | 'checking' | 'allowed' | 'denied' | 'unavailable'

export function createAdminPermissionStore(
  users: Readable<PermissionUser>,
  loadPermission: () => Promise<boolean>
) {
  return readable<AdminPermission>('signed-out', (set) => {
    let revision = 0
    const unsubscribe = users.subscribe((user) => {
      const request = ++revision
      if (!user) {
        set('signed-out')
        return
      }
      set('checking')
      void loadPermission()
        .then((allowed) => {
          // ログアウトやアカウント変更より前の応答で管理画面を表示しない。
          if (request === revision) set(allowed === true ? 'allowed' : 'denied')
        })
        .catch(() => {
          if (request === revision) set('unavailable')
        })
    })
    return () => {
      revision += 1
      unsubscribe()
    }
  })
}
