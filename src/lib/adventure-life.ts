import type { Episode } from './adventure-catalog'

export const dailyEpisodes: Episode[] = [
  {
    id: 'daily-today',
    title: '今日のことを、少しだけ',
    subtitle: '今の二人の日常',
    setting:
      '本編の結末を引き継いだ二人。今日話したいことや気持ちを、実際に話せる範囲で分け合う。以前の会話があれば自然に一つ触れる。',
    opener:
      '今日は、どんなふうに過ごしていましたか。私は、こうして話せる時間を楽しみにしていました。',
    coachingProfile: 'interests',
    missionId: 'feeling',
    theme: 'cafe'
  },
  {
    id: 'daily-plan',
    title: '次にしたいこと',
    subtitle: '小さな約束を、重ねよう',
    setting:
      '本編の結末を引き継いだ二人が次の予定を相談する。過去の約束や本人の好みを自然に参照し、現在の都合を確かめる。',
    opener: '次に一緒に過ごすなら、どんな時間がいいでしょう。今の気分を聞きたいな。',
    coachingProfile: 'invitation',
    missionId: 'invite',
    theme: 'street'
  },
  {
    id: 'daily-honesty',
    title: '本音を、話してみる',
    subtitle: '今の二人で、相談する',
    setting:
      '本編の結末を引き継いだ二人。本人が気になっていること・困りごと・伝えたい希望を相談する。実際の個人情報や体験を求めず、練習したい内容を架空の状況として扱ってもよい。',
    opener: '一緒に過ごすなかで、話しておきたいことがあったら聞きたいです。小さなことでも。',
    coachingProfile: 'conflict',
    missionId: 'request',
    theme: 'cafe'
  },
  {
    id: 'daily-quiet',
    title: '何もない日も、一緒に',
    subtitle: '言葉を急がない時間',
    setting:
      '本編の結末を引き継いだ二人が静かな時間を共有する。無理に話題を増やさず、今感じていることや過ごし方を確かめる。',
    opener: '……今日は、少しゆっくりできそうですね。こういう時間もいいなと思って。',
    coachingProfile: 'silence',
    missionId: 'calm',
    theme: 'evening'
  }
]
const seasonalThemes = [
  ['新しい年に、したいこと', '冬の日の、温かい一杯'],
  ['小さな贈り物の、相談', '春を待つ、帰り道'],
  ['いつもの道に、春の気配', '新しく始めたいこと'],
  ['花の下で、ひと休み', '新しい暮らしの、ペース'],
  ['少し遠くへ、出かけよう', '風の気持ちいい、午後'],
  ['雨の日の、お出かけ', '傘を閉じた、そのあと'],
  ['暑い日の、待ち合わせ', '夕涼みの、小さな約束'],
  ['夏の夜の、寄り道', '涼しい場所で、のんびり'],
  ['夏の終わりに、話したいこと', '秋にしてみたいこと'],
  ['秋の景色を、見つけよう', '温かい料理を、一緒に'],
  ['色づく公園で、ひと休み', '寒い日の、温かい飲み物'],
  ['冬の灯りを、見に行こう', '今年の思い出、これからの約束']
] as const
const tokyoParts = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
export function eventEpisode(id: unknown): Episode | undefined {
  if (typeof id !== 'string') return undefined
  const match = /^event-(20\d{2})-(0[1-9]|1[0-2])-([12])$/.exec(id)
  if (!match || `${match[1]}-${match[2]}` < '2026-11') return undefined
  const month = Number(match[2]),
    slot = Number(match[3])
  const title = seasonalThemes[month - 1][slot - 1]
  return {
    id,
    title,
    subtitle: `${match[1]}年${month}月 ${slot === 1 ? '上旬' : '下旬'}のイベント`,
    setting: `本編の結末を引き継いだ二人の季節イベント「${title}」。キャラクターの好みと、本人との過去の会話・約束を踏まえて過ごす。知らない体験は作らず、今の気持ちや希望を話し合う。`,
    opener:
      slot === 1
        ? '季節が少し変わりましたね。一緒に、いつもと違う時間を過ごせたらと思って。'
        : 'このところのことを、ゆっくり話したくなりました。今、一緒にしたいことはありますか？',
    coachingProfile: slot === 1 ? 'interests' : 'invitation',
    missionId: slot === 1 ? 'feeling' : 'invite',
    theme: month >= 10 || month <= 2 ? 'evening' : 'street'
  }
}
export function eventReleaseAt(id: string) {
  const match = /^event-(20\d{2})-(\d{2})-([12])$/.exec(id)
  return match
    ? new Date(`${match[1]}-${match[2]}-${match[3] === '1' ? '01' : '16'}T00:00:00+09:00`)
    : null
}
export function eventPublished(id: string, now = new Date()) {
  const release = eventReleaseAt(id)
  return !!release && release <= now
}
export function publishedEvents(now = new Date()): Episode[] {
  const parts = tokyoParts(now)
  const year = Number(parts.find((p) => p.type === 'year')!.value),
    month = Number(parts.find((p) => p.type === 'month')!.value)
  const result: Episode[] = []
  for (let y = 2026; y <= year; y++)
    for (let m = y === 2026 ? 11 : 1; m <= (y === year ? month : 12); m++)
      for (const slot of [1, 2]) {
        const id = `event-${y}-${String(m).padStart(2, '0')}-${slot}`
        if (eventPublished(id, now)) result.push(eventEpisode(id)!)
      }
  return result.reverse()
}
