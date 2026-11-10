import { writable } from 'svelte/store'

interface ReportState<T> {
  data: T | null
  pending: boolean
  error: string
}
export function createAdminReport<T>(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>
) {
  const state = writable<ReportState<T>>({ data: null, pending: false, error: '' })
  let key = '',
    revision = 0,
    controller: AbortController | null = null,
    pendingTimer: ReturnType<typeof setTimeout> | null = null
  function load(uid: string | null, path: string, force = false) {
    const next = uid ? `${uid}:${path}` : ''
    if (!force && next === key) return
    key = next
    const current = ++revision
    controller?.abort()
    if (pendingTimer) clearTimeout(pendingTimer)
    if (!uid) {
      state.set({ data: null, pending: false, error: '' })
      return
    }
    controller = new AbortController()
    const activeController = controller
    state.set({ data: null, pending: true, error: '' })
    const timeout = setTimeout(() => {
      if (current !== revision) return
      revision += 1
      activeController.abort()
      state.set({
        data: null,
        pending: false,
        error: '読み込みに時間がかかっています。再度お試しください。'
      })
    }, 15000)
    pendingTimer = timeout
    void fetcher(path, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('情報を読み込めませんでした。')
        const data = (await response.json()) as T
        // アカウント・検索・期間の切替前に始めた応答から個人情報を復活させない。
        if (current === revision) state.set({ data, pending: false, error: '' })
      })
      .catch((cause) => {
        if (current === revision)
          state.set({
            data: null,
            pending: false,
            error: cause instanceof Error ? cause.message : '情報を読み込めませんでした。'
          })
      })
      .finally(() => {
        clearTimeout(timeout)
        if (pendingTimer === timeout) pendingTimer = null
      })
  }
  return {
    subscribe: state.subscribe,
    load,
    destroy() {
      revision += 1
      controller?.abort()
      if (pendingTimer) clearTimeout(pendingTimer)
      key = ''
      state.set({ data: null, pending: false, error: '' })
    }
  }
}
