import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { isKnowledgeAdmin, requireKnowledgeAdmin } from './knowledge-admin-auth'
import { requireFirebaseUser } from './request-auth'
import { GET } from '../../routes/api/me/permissions/+server'

vi.mock('./request-auth', () => ({ requireFirebaseUser: vi.fn() }))
const identity = {
  uid: 'new-admin-fixture',
  email: 'admin@example.test',
  email_verified: true,
  firebase: { sign_in_provider: 'google.com', identities: {} }
} as DecodedIdToken
beforeEach(() => {
  vi.stubEnv('KOITRE_ADMIN_UIDS', ' existing-admin-fixture ')
  vi.stubEnv('KOITRE_ADMIN_GOOGLE_EMAILS', ' ADMIN@example.test , second@example.test ')
  vi.mocked(requireFirebaseUser).mockResolvedValue(identity)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})
describe('管理者のUIDと確認済みGoogleメール', () => {
  it('既存のUID管理者を保ち、追加Googleメールも許可する', () => {
    expect(isKnowledgeAdmin('existing-admin-fixture')).toBe(true)
    expect(isKnowledgeAdmin(identity.uid, identity)).toBe(true)
    expect(isKnowledgeAdmin('another-fixture', { ...identity, email: 'Second@example.test' })).toBe(
      true
    )
  })
  it.each([
    { email: 'other@example.test' },
    { email: 'admin@example.test.attacker.test' },
    { email: undefined },
    { email_verified: false },
    { email_verified: undefined },
    { firebase: { sign_in_provider: 'password' } },
    { firebase: { sign_in_provider: 'custom' } },
    { firebase: undefined }
  ])('未指定・未確認・Google以外の本人情報を許可しない: %j', (override) => {
    expect(isKnowledgeAdmin(identity.uid, { ...identity, ...override })).toBe(false)
  })
  it('両リストが空なら管理者を付けず、ワイルドカードにも展開しない', () => {
    vi.stubEnv('KOITRE_ADMIN_UIDS', '')
    vi.stubEnv('KOITRE_ADMIN_GOOGLE_EMAILS', '')
    expect(isKnowledgeAdmin('existing-admin-fixture')).toBe(false)
    expect(isKnowledgeAdmin(identity.uid, identity)).toBe(false)
    vi.stubEnv('KOITRE_ADMIN_GOOGLE_EMAILS', '*')
    expect(isKnowledgeAdmin(identity.uid, identity)).toBe(false)
  })
  it('権限APIと管理APIの認可が同じ本人情報を使い、権限応答をキャッシュさせない', async () => {
    const request = new Request('http://local/api/me/permissions', {
      headers: { authorization: 'Bearer fixture-only' }
    })
    const response = await GET({ request } as never)
    expect(await response.json()).toEqual({ knowledgeAdmin: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await requireKnowledgeAdmin(request)).toEqual(identity)
    vi.mocked(requireFirebaseUser).mockResolvedValue({ ...identity, email_verified: false })
    expect(await (await GET({ request } as never)).json()).toEqual({ knowledgeAdmin: false })
    await expect(requireKnowledgeAdmin(request)).rejects.toMatchObject({ status: 403 })
  })
  it('未認証の権限APIと管理APIは401を維持する', async () => {
    vi.mocked(requireFirebaseUser).mockRejectedValue({ status: 401 })
    const request = new Request('http://local/api/me/permissions')
    await expect(GET({ request } as never)).rejects.toMatchObject({ status: 401 })
    await expect(requireKnowledgeAdmin(request)).rejects.toMatchObject({ status: 401 })
  })
})
