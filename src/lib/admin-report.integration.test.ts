import { get } from 'svelte/store'
import { describe, expect, it, vi } from 'vitest'
import { createAdminReport } from './admin-report'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
describe('管理情報の読み込み状態', () => {
  it('未ログインはリクエストせず、ログアウト・アカウント切替前の応答を破棄する', async () => {
    let resolve: (r: Response) => void = () => {}
    const fetcher = vi.fn(() => new Promise<Response>((r) => (resolve = r)))
    const report = createAdminReport<{ secret: string }>(fetcher)
    report.load(null, '/fixture')
    expect(fetcher).not.toHaveBeenCalled()
    report.load('admin-a', '/fixture')
    expect(get(report).pending).toBe(true)
    report.load(null, '/fixture')
    resolve(Response.json({ secret: 'old-account' }))
    await tick()
    expect(get(report)).toEqual({ data: null, pending: false, error: '' })
    report.load('admin-a', '/fixture')
    const old = resolve
    report.load('admin-b', '/fixture')
    old(Response.json({ secret: 'wrong-account' }))
    await tick()
    expect(get(report).data).toBeNull()
    resolve(Response.json({ secret: 'current-account' }))
    await tick()
    expect(get(report).data?.secret).toBe('current-account')
    report.destroy()
  })
  it('検索・期間切替の古い結果を破棄し、同じ条件は再取得しない', async () => {
    const jobs: ((r: Response) => void)[] = []
    const fetcher = vi.fn(() => new Promise<Response>((r) => jobs.push(r)))
    const report = createAdminReport<{ period: number }>(fetcher)
    report.load('admin', '/fixture?days=30')
    report.load('admin', '/fixture?days=30')
    report.load('admin', '/fixture?days=7')
    expect(fetcher).toHaveBeenCalledTimes(2)
    jobs[1](Response.json({ period: 7 }))
    await tick()
    jobs[0](Response.json({ period: 30 }))
    await tick()
    expect(get(report).data).toEqual({ period: 7 })
    report.destroy()
  })
  it('読み込み失敗は正常0件へ変換せず、再試行できる', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(Error('再試行してください'))
      .mockResolvedValueOnce(Response.json({ total: 0 }))
    const report = createAdminReport<{ total: number }>(fetcher)
    report.load('admin', '/fixture')
    await tick()
    expect(get(report)).toMatchObject({ data: null, pending: false, error: '再試行してください' })
    report.load('admin', '/fixture', true)
    await tick()
    expect(get(report)).toEqual({ data: { total: 0 }, pending: false, error: '' })
    report.destroy()
  })
  it('通信が戻らない場合は読み込み中を終了し、遅れて到着した値を表示しない', async () => {
    vi.useFakeTimers()
    try {
      let resolve: (r: Response) => void = () => {}
      const report = createAdminReport<{ total: number }>(
        () => new Promise<Response>((r) => (resolve = r))
      )
      report.load('admin', '/fixture')
      await vi.advanceTimersByTimeAsync(15000)
      expect(get(report)).toMatchObject({
        data: null,
        pending: false,
        error: expect.stringContaining('時間がかかっています')
      })
      resolve(Response.json({ total: 99 }))
      await vi.runAllTimersAsync()
      expect(get(report).data).toBeNull()
      report.destroy()
    } finally {
      vi.useRealTimers()
    }
  })
})
