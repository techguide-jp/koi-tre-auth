import { describe, expect, it } from 'vitest'
import { analysisAspects, assessmentLabel, assessmentStatus, assessmentValue } from '$lib/practice'
import { parsePracticeOutput } from './practice-feedback'
import { parseAssessment } from './jev-practice'
import { exampleFeedback, exampleJevResponse, exampleTexts } from './fixtures/practice-analysis'

function output() {
  return { reply: '教えてくれてありがとうございます。', feedback: structuredClone(exampleFeedback) }
}
describe('会話に基づく分析', () => {
  it('総評・複数の強みと改善点・5観点・3返答の言い換え・次の目標を保持する', () => {
    const value = output()
    expect(parsePracticeOutput(JSON.stringify(value), exampleTexts, true)).toEqual(value)
    expect(value.feedback.analysis?.strengths).toHaveLength(2)
    expect(value.feedback.analysis?.improvements).toHaveLength(2)
  })
  it('引用した短い部分を保ち、発言全体へ置き換えない', () => {
    const value = output()
    value.feedback.quote = '知っていますか？'
    value.feedback.analysis!.turns[2].quote = 'どんな本が好きですか？'
    expect(parsePracticeOutput(value, exampleTexts, true)).toEqual(value)
  })
  it.each(['strengths', 'improvements', 'aspects'] as const)(
    '%sの実在しない引用を拒否する',
    (key) => {
      const value = output()
      value.feedback.analysis![key][0].evidence = [{ turn: 1, quote: '初めて言ったこと' }]
      expect(() => parsePracticeOutput(value, exampleTexts, true)).toThrow('quote')
    }
  )
  it('別の返答にある引用を指定した番号で引用した場合も拒否する', () => {
    const value = output()
    value.feedback.analysis!.turns[0].quote = exampleTexts[2]
    expect(() => parsePracticeOutput(value, exampleTexts, true)).toThrow('quote')
  })
  it('返答や観点の欠落・重複、空の分析、未知のバージョンを拒否する', () => {
    for (const mutate of [
      (v: ReturnType<typeof output>) => v.feedback.analysis!.turns.pop(),
      (v: ReturnType<typeof output>) =>
        (v.feedback.analysis!.turns[0] = v.feedback.analysis!.turns[1]),
      (v: ReturnType<typeof output>) =>
        (v.feedback.analysis!.aspects[0] = v.feedback.analysis!.aspects[1]),
      (v: ReturnType<typeof output>) => (v.feedback.analysis!.strengths = []),
      (v: ReturnType<typeof output>) => (v.feedback.analysis!.summary = ''),
      (v: ReturnType<typeof output>) => Object.assign(v.feedback.analysis!, { version: 99 })
    ]) {
      const value = output()
      mutate(value)
      expect(() => parsePracticeOutput(value, exampleTexts, true)).toThrow()
    }
  })
  it('LLMが生成したJev判定を破棄し、実際に取得した補助判定だけを採用する', () => {
    const value = output()
    const assessment = parseAssessment(exampleJevResponse())
    value.feedback.analysis!.assessment = assessment
    expect(parsePracticeOutput(value, exampleTexts, true).feedback?.analysis).not.toHaveProperty(
      'assessment'
    )
    expect(
      parsePracticeOutput(value, exampleTexts, true, assessment).feedback?.analysis?.assessment
    ).toEqual(assessment)
  })
  it('過去形式の改善点と言い換えをそのまま返す', () => {
    const value = output()
    delete value.feedback.analysis
    expect(parsePracticeOutput(value, exampleTexts, true)).toEqual(value)
  })
  it('保存できないNUL文字を含む生成結果を拒否する', () => {
    const value = output()
    value.feedback.analysis!.summary = '会話の分析\0続き'
    expect(() => parsePracticeOutput(value, exampleTexts, true)).toThrow()
  })
  it('改善が不要な会話では改善点の水増しを要求しない', () => {
    const value = output()
    value.feedback.analysis!.improvements = []
    expect(parsePracticeOutput(value, exampleTexts, true).feedback?.analysis?.improvements).toEqual(
      []
    )
  })
  it('近い段階で迷う評価を参考表示し、材料不足と区別する', () => {
    const value = { id: analysisAspects[0].id, score: 2.4, confidence: 0.4, observable: 0.9 }
    expect(assessmentStatus(value)).toBe('reference')
    expect(assessmentValue(value)).toBe(2.4)
    expect(assessmentStatus({ ...value, observable: 0.2 })).toBe('insufficient')
    expect(assessmentLabel({ ...value, observable: 0.2 })).toBe('材料不足')
  })
  it('グラフの未評価・判断保留と、評価済みの0を区別する', () => {
    const value = { id: 'questions' as const, score: 0, confidence: 0.9, observable: 0.9 }
    expect(assessmentValue()).toBeNull()
    expect(assessmentValue({ ...value, confidence: 0.69 })).toBe(0)
    expect(assessmentValue({ ...value, observable: 0.69 })).toBeNull()
    expect(assessmentValue(value)).toBe(0)
    expect(assessmentLabel(value)).toBe('工夫の余地あり')
    expect(assessmentValue({ ...value, score: NaN })).toBeNull()
    expect(assessmentValue({ ...value, score: 3.1 })).toBeNull()
  })
  it('隣接する段階の間のスコアは保持し、極端に割れた平均値は描かない', () => {
    const base = { id: analysisAspects[0].id, score: 1.5, confidence: 0.1, observable: 0.9 }
    expect(assessmentValue({ ...base, probabilities: [0, 0.5, 0.5, 0] })).toBe(1.5)
    for (const probabilities of [
      [0.5, 0, 0, 0.5],
      [0.25, 0.25, 0.25, 0.25]
    ] as const) {
      const value = {
        ...base,
        probabilities: [...probabilities] as [number, number, number, number]
      }
      expect(assessmentStatus(value)).toBe('uncertain')
      expect(assessmentValue(value)).toBeNull()
      expect(assessmentLabel(value)).toBe('評価に幅あり')
    }
  })
  it('不正な分布や確信度を参考値として描かない', () => {
    const base = { id: analysisAspects[0].id, score: 1.5, confidence: 0.4, observable: 0.9 }
    for (const patch of [
      { confidence: NaN },
      { confidence: -1 },
      { observable: Infinity },
      { probabilities: [0, NaN, 0, 1] as [number, number, number, number] },
      { probabilities: [0, 0.2, 0.2, 0] as [number, number, number, number] }
    ])
      expect(assessmentValue({ ...base, ...patch })).toBeNull()
  })
})
