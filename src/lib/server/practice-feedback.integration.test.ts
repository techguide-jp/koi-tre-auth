import { describe, expect, it } from 'vitest'
import { analysisAspects, assessmentLabel, assessmentValue } from '$lib/practice'
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
  it('低確信や機会がない観点では良否を断定しない', () => {
    for (const extra of [{ confidence: 0.4 }, { observable: 0.2 }])
      expect(
        assessmentLabel({
          id: analysisAspects[0].id,
          score: 0,
          confidence: 1,
          observable: 1,
          ...extra
        })
      ).toBe('判断保留')
  })
  it('グラフの未評価・判断保留と、評価済みの0を区別する', () => {
    const value = { id: 'questions' as const, score: 0, confidence: 0.9, observable: 0.9 }
    expect(assessmentValue()).toBeNull()
    expect(assessmentValue({ ...value, confidence: 0.69 })).toBeNull()
    expect(assessmentValue({ ...value, observable: 0.69 })).toBeNull()
    expect(assessmentValue(value)).toBe(0)
    expect(assessmentLabel(value)).toBe('工夫の余地あり')
    expect(assessmentValue({ ...value, score: NaN })).toBeNull()
    expect(assessmentValue({ ...value, score: 3.1 })).toBeNull()
  })
})
