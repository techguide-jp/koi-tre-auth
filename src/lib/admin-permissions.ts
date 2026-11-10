import { readable, type Readable } from 'svelte/store'

type PermissionUser = { uid: string } | null

export function createAdminPermissionStore(
  users: Readable<PermissionUser>,
  loadPermission: () => Promise<boolean>
) {
  return readable(false, (set) => {
    let revision = 0
    const unsubscribe = users.subscribe((user) => {
      const request = ++revision
      set(false)
      if (!user) return
      void loadPermission()
        .then((allowed) => {
          // ログアウトやアカウント変更より前の応答で管理リンクを復活させない。
          if (request === revision) set(allowed === true)
        })
        .catch(() => {
          if (request === revision) set(false)
        })
    })
    return () => {
      revision += 1
      unsubscribe()
    }
  })
}
