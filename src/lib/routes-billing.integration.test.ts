import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  allocateCredits,
  availableCredits,
  billingProduct,
  practiceCreditCost,
  productPrice,
  type CreditGrantView
} from './billing'
import {
  adventureAccess,
  episodeById,
  normalizeAdventure,
  parseStoryEnding,
  episodeKey,
  type Adventure
} from './adventure'
import { storyParts } from './adventure-story'
import { eventPublished, publishedEvents } from './adventure-life'
import { analysisAspects, assessmentTotal, assessmentPoints, assessmentStatus } from './practice'
import { parseAssessment, practiceQuestions } from './server/jev-practice'
import { parsePracticeOutput } from './server/practice-feedback'
import { exampleFeedback, exampleTexts } from './server/fixtures/practice-analysis'
import { stripeReady, stripeClient } from './server/stripe-client'
const adventure: Adventure = { version: 1, characterId: 'aoi', episodeId: 'aoi-4', turns: 6 }
const grants: CreditGrantView[] = [
  { id: 'route-aoi', kind: 'route', characterId: 'aoi', units: 24, remaining: 24, expiresAt: null },
  { id: 'free', kind: 'free', characterId: null, units: 10, remaining: 1, expiresAt: '2026-12-01' },
  { id: 'route-yu', kind: 'route', characterId: 'yu', units: 24, remaining: 24, expiresAt: null }
]
afterEach(() => vi.unstubAllEnvs())
describe('ルート・月額・再練習の共通ルール', () => {
  it('3往復1枠・6往復2枠と、本人のキャラに使える枠を計算する', () => {
    expect(practiceCreditCost(3)).toBe(1)
    expect(practiceCreditCost(6)).toBe(2)
    expect(availableCredits(grants, 'aoi', true)).toBe(25)
    expect(availableCredits(grants, 'rin', true)).toBe(1)
    expect(availableCredits(grants, 'aoi', false)).toBe(1)
    expect(allocateCredits(grants, 2, 'aoi', true)).toEqual([
      { grantId: 'free', units: 1 },
      { grantId: 'route-aoi', units: 1 }
    ])
    expect(allocateCredits(grants, 2, 'aoi', false)).toBeNull()
  })
  it('未購入の本編・未クリアの前話・未読の再練習をそれぞれ拒否する', () => {
    const completed = ['aoi:aoi-3']
    expect(adventureAccess(adventure, completed, [], false)).toBe('purchase')
    expect(adventureAccess(adventure, [], ['aoi'], false)).toBe('locked')
    expect(adventureAccess(adventure, completed, ['aoi'], false)).toBe('available')
    expect(adventureAccess({ ...adventure, revisit: true }, completed, ['aoi'], false)).toBe(
      'locked'
    )
    expect(
      adventureAccess({ ...adventure, revisit: true }, [...completed, 'aoi:aoi-4'], ['aoi'], false)
    ).toBe('available')
    expect(storyParts.map((p) => p.id)).toEqual(['meeting', 'date', 'honesty', 'feelings'])
  })
  it('Plus・結末到達・イベント公開日を確認し、Plusに人物購入を要求しない', () => {
    const daily = { ...adventure, episodeId: 'daily-today' }
    expect(adventureAccess(daily, [], ['aoi'], true)).toBe('locked')
    expect(adventureAccess(daily, ['aoi:aoi-12'], [], true)).toBe('available')
    expect(adventureAccess(daily, ['aoi:aoi-12'], ['aoi'], false)).toBe('plus')
    expect(adventureAccess(daily, ['aoi:aoi-12'], ['aoi'], true)).toBe('available')
    const event = { ...daily, episodeId: 'event-2026-11-2' }
    expect(
      adventureAccess(event, ['aoi:aoi-12'], ['aoi'], true, new Date('2026-11-15T14:59:59Z'))
    ).toBe('unpublished')
    expect(eventPublished(event.episodeId, new Date('2026-11-15T15:00:00Z'))).toBe(true)
    expect(publishedEvents(new Date('2026-11-08T00:00:00Z')).map((e) => e.id)).toEqual([
      'event-2026-11-1'
    ])
    expect(episodeById('event-2026-13-1')).toBeUndefined()
  })
  it('クライアントの価格・枠数を使わず、人物と再練習の指定だけを正規化する', () => {
    expect(billingProduct({ kind: 'route', characterId: 'aoi', price: 1, credits: 999 })).toEqual({
      kind: 'route',
      characterId: 'aoi'
    })
    expect(billingProduct({ kind: 'route', characterId: 'unknown' })).toBeNull()
    expect(normalizeAdventure({ ...adventure, revisit: true, ending: 'lovers' })).toEqual({
      ...adventure,
      revisit: true
    })
  })
  it('Plusだけで本編を攻略・再練習でき、契約終了後は購入権を必要とする', () => {
    const cleared = ['aoi:aoi-3', 'aoi:aoi-4']
    expect(adventureAccess(adventure, cleared, [], true)).toBe('available')
    expect(adventureAccess({ ...adventure, revisit: true }, cleared, [], true)).toBe('available')
    expect(adventureAccess({ ...adventure, revisit: true }, cleared, [], false)).toBe('purchase')
    expect(adventureAccess(adventure, cleared, ['aoi'], false)).toBe('available')
    expect(adventureAccess({ ...adventure, episodeId: 'aoi-6' }, cleared, [], true)).toBe('locked')
  })
  it('追加共通枠は人物を問わず使え、無料・人物専用・追加購入の順に合算する', () => {
    const topup: CreditGrantView = {
      id: 'topup',
      kind: 'topup',
      characterId: null,
      units: 15,
      remaining: 15,
      expiresAt: null
    }
    const mixed = [topup, ...grants]
    expect(allocateCredits(mixed, 2, 'aoi', true)).toEqual([
      { grantId: 'free', units: 1 },
      { grantId: 'route-aoi', units: 1 }
    ])
    expect(allocateCredits(mixed, 2, 'rin', true)).toEqual([
      { grantId: 'free', units: 1 },
      { grantId: 'topup', units: 1 }
    ])
    expect(availableCredits(mixed, 'rin', false)).toBe(16)
    expect(billingProduct({ kind: 'topup', price: 1, credits: 999, characterId: 'aoi' })).toEqual({
      kind: 'topup'
    })
    expect(productPrice({ kind: 'topup' })).toBe(550)
    expect(adventureAccess(adventure, ['aoi:aoi-3'], [], false)).toBe('purchase')
  })
  it('物語の結末には12話の実際の本人の引用が必要', () => {
    const ending = {
      kind: 'lovers',
      reason: '互いの気持ちを確かめました。',
      evidence: [{ turn: 1, quote: 'あなたと付き合いたいです。' }]
    }
    const final = { ...adventure, episodeId: 'aoi-12' }
    expect(parseStoryEnding(ending, final, ['あなたと付き合いたいです。'])?.kind).toBe('lovers')
    expect(parseStoryEnding(ending, adventure, ['あなたと付き合いたいです。'])).toBeNull()
    expect(parseStoryEnding(ending, final, ['今日はありがとう。'])).toBeNull()
    expect(episodeKey('aoi', 'aoi-12')).toBe('aoi:aoi-12')
  })
  it('テストの設定が不足した場合と本番環境で購入を有効にしない', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture')
    vi.stubEnv('BILLING_ENABLED', 'true')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_fixture')
    vi.stubEnv('STRIPE_PORTAL_CONFIGURATION_ID', 'bpc_fixture')
    for (const id of ['AOI', 'RIN', 'SHIORI', 'YU', 'SOTA', 'REN'])
      vi.stubEnv(`STRIPE_PRICE_ROUTE_${id}`, `price_${id}`)
    vi.stubEnv('STRIPE_PRICE_PLUS', 'price_plus')
    vi.stubEnv('STRIPE_PRICE_TOPUP', 'price_topup')
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(stripeReady()).toBe(true)
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(stripeReady()).toBe(false)
    expect(() => stripeClient()).toThrow('test configuration')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_fixture')
    expect(stripeReady()).toBe(false)
  })
})
describe('5観点25点の評価と旧履歴', () => {
  const response = (score: number) => ({
    model: 'jev-fixture',
    answers: Object.fromEntries(
      analysisAspects.flatMap((a) => [
        [
          a.id,
          {
            type: 'score',
            score,
            confidence: 0.8,
            probabilities: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }
          }
        ],
        [`${a.id}_observable`, { type: 'noul', noul: 0.99 }]
      ])
    )
  })
  it('実際の6段階出力だけから5点×5観点・25点を求める', () => {
    const assessment = parseAssessment(response(5), 5)
    assessment.rubric = { version: 3, profile: 'interests' }
    expect(assessmentTotal(assessment)).toBe(25)
    expect(practiceQuestions().questions.criteria).toHaveLength(6)
    expect(practiceQuestions().questions.instructions).toContain('受け渡し')
    expect(() => parseAssessment(response(5), 3)).toThrow()
  })
  it('未評価を0点で補完せず、重複観点や不正な分布も合計しない', () => {
    const assessment = parseAssessment(response(4.6), 5)
    expect(assessmentTotal(assessment)).toBe(23)
    assessment.aspects[0].observable = 0.1
    expect(assessmentTotal(assessment)).toBeNull()
    assessment.aspects[0].observable = 0.99
    assessment.aspects[0].probabilities = [0.5, 0, 0, 0, 0, 0.5]
    expect(assessmentStatus(assessment.aspects[0])).toBe('uncertain')
    assessment.aspects[0] = assessment.aspects[1]
    expect(assessmentTotal(assessment)).toBeNull()
  })
  it('保存済み0〜3基準は書き換えずに表示用の点へ換算する', () => {
    const old = { id: 'questions' as const, score: 3, confidence: 0.9, observable: 0.99 }
    expect(assessmentPoints(old)).toBe(5)
    expect(old.score).toBe(3)
  })
  it('新しい6往復分析は6返答と前後の引用を検査し、旧代表3返答は互換を保つ', () => {
    const texts = [...exampleTexts, ...exampleTexts],
      feedback = structuredClone(exampleFeedback)
    feedback.analysis!.version = 3
    feedback.analysis!.turns = [
      ...feedback.analysis!.turns,
      ...feedback.analysis!.turns.map((t) => ({ ...t, turn: t.turn + 3 }))
    ]
    feedback.analysis!.development = {
      observation: '自分の好みを伝えたあと、質問が続いています。',
      before: { turn: 1, quote: texts[0] },
      after: { turn: 6, quote: texts[5] }
    }
    expect(
      parsePracticeOutput({ reply: 'ありがとう。', feedback }, texts, true).feedback?.analysis
        ?.turns
    ).toHaveLength(6)
    const multiple = structuredClone(feedback) as unknown as { analysis: { development: unknown } }
    multiple.analysis.development = {
      observation: '希望を一貫して伝えています。',
      before: [
        { turn: 1, quote: texts[0] },
        { turn: 2, quote: texts[1] }
      ],
      after: [
        { turn: 5, quote: texts[4] },
        { turn: 6, quote: texts[5] }
      ]
    }
    expect(
      parsePracticeOutput({ reply: 'ありがとう。', feedback: multiple }, texts, true).feedback
        ?.analysis?.development?.after.turn
    ).toBe(6)
    ;(
      multiple.analysis.development as { before: { turn: number; quote: string }[] }
    ).before[1].quote = '架空の引用'
    expect(() =>
      parsePracticeOutput({ reply: 'ありがとう。', feedback: multiple }, texts, true)
    ).toThrow('quote')
    feedback.analysis!.development.after.turn = 3
    expect(() => parsePracticeOutput({ reply: 'ありがとう。', feedback }, texts, true)).toThrow(
      'development'
    )
    delete feedback.analysis!.development
    feedback.analysis!.turns.pop()
    expect(() => parsePracticeOutput({ reply: 'ありがとう。', feedback }, texts, true)).toThrow(
      'list'
    )
    expect(
      parsePracticeOutput({ reply: 'ありがとう。', feedback: exampleFeedback }, texts, true)
        .feedback?.analysis?.turns
    ).toHaveLength(3)
  })
})
