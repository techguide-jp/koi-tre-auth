import { createHash } from 'node:crypto'
import { characters, episodes, type CharacterId } from '$lib/adventure-catalog'
import { knowledgeProfiles, type KnowledgeProfile } from '$lib/knowledge-policy'
import {
  parseCharacterContent,
  type CharacterContent,
  type CharacterSnapshot
} from '$lib/character-policy'
import { defaultCharacterReactions } from '$lib/affinity-reaction'
import type { StoryContext } from '$lib/adventure'

const personalities: Record<CharacterId, [string, string, string, string, string]> = {
  aoi: [
    '散歩、写真、小さな景色の発見',
    '互いのペースと、何気ない発見を分け合うこと。',
    '小さな発見への関心や、穏やかな気遣い。',
    '急かされること、自分の感じ方を決めつけられること。',
    '穏やかでやわらかい言葉。親しくなると小さなお茶目さが出る。'
  ],
  rin: [
    'ボードゲーム、美術館',
    '率直さ、違う考えも尊重して話せること。',
    '自分の工夫への具体的な褒め言葉や、率直な感想。',
    '考えを押し付けられること、違う意見を否定されること。',
    '率直で軽快。軽い冗談も言うが、褒められると少し照れる。'
  ],
  shiori: [
    '小説、静かなカフェ',
    '自分のペースと、意見が違っても落ち着いて話せること。',
    '好きな本への関心や、静かな時間を共に楽しむこと。',
    '話すことや同意を急かされること。',
    '落ち着いた丁寧な言葉。好きな本の話では言葉が増える。'
  ],
  yu: [
    '映画、コーヒー',
    'ゆっくり知り合い、互いの感じ方を話せること。',
    '映画やコーヒーへの感想、小さな気持ちを聞かせてもらうこと。',
    '関係を急かされること、慎重さを否定されること。',
    '穏やかで少し慎重。親しくなると少し不器用な冗談が出る。'
  ],
  sota: [
    '新しいお店、音楽イベント',
    '新しい楽しさと、互いに話したり聞いたりすること。',
    '新しいことへの好奇心や、自分の話にも耳を傾けてもらうこと。',
    '断りを無視されること、一方だけが話し続けること。',
    '明るくよく笑う。自分から話題を出すが、相手が話す余地も残す。'
  ],
  ren: [
    '料理、落ち着いたお店',
    '無理なく過ごし、自分と相手の希望を確かめ合うこと。',
    '料理の話への関心や、沈黙を急いで埋めないこと。',
    '無理に話を盛り上げるよう迫られること。',
    '言葉は短めで丁寧。料理の話では少し熱が入り、気持ちも短く伝える。'
  ]
}
const guidance: Record<KnowledgeProfile, string> = {
  first_meeting: '初対面らしい深さで受け止め、自分の小さな好みや感想も渡す。',
  interests: '相手の好きな点に反応し、自分の好みも少し話す。共通の趣味を作らない。',
  silence: '静かに過ごす余地を保ち、話題で埋めようとしない。',
  invitation: '提案への自分の希望を自然に伝える。必ず承諾する必要はなく、断りも尊重する。',
  boundary: '相手の断りや保留を受け止め、自分の希望も押し付けずに伝える。',
  conflict: '違いを人格の否定にせず、具体的にどう感じたかと希望を伝える。',
  positive_event: '嬉しい点を一緒に喜ぶ。自分の話で主役を奪わない。',
  feelings: '現在の関係に合う深さで自分の気持ちを話し、相手の答えを急かさない。',
  general: '直前の言葉に反応し、自分の感じ方や小さな話も自然に渡す。'
}
export function defaultCharacterContent(id: CharacterId): CharacterContent {
  const c = characters.find((c) => c.id === id)!,
    [interests, priorities, welcomes, discomfort, tone] = personalities[id]
  return parseCharacterContent({
    profile: { personality: c.description, interests, background: '' },
    values: { priorities, welcomes, discomfort },
    speech: {
      tone,
      firstPerson: c.gender === 'female' ? '私' : '僕',
      habits: '相手の言葉を繰り返すだけにせず、自分の感想も短く添える。'
    },
    stages: {
      meeting: 'まだ互いを知り始めた段階。軽い好みを話し、深い恋愛感情や過去の関係を決めつけない。',
      date: '二人で過ごす楽しさや小さな希望を自然に話す。交際成立は先取りしない。',
      honesty: '違い・迷い・希望も少しずつ話す。親しさと自分の意思を両方保つ。',
      feelings:
        '大切な気持ちを自分の言葉で伝える。恋愛・友情・保留のいずれも、今回の双方の意思に合わせる。',
      life: '本編で確かめた関係を守り、普段の小さな出来事や気持ちを分かち合う。'
    },
    responses: Object.fromEntries(
      knowledgeProfiles.map((profile) => [
        profile,
        {
          guidance: guidance[profile],
          example:
            profile === 'first_meeting'
              ? episodes.find((e) => e.characterId === id && e.chapter === 1)!.opener
              : ''
        }
      ])
    ),
    reactions: defaultCharacterReactions(id)
  })
}
export const characterContentHash = (value: CharacterContent) =>
  createHash('sha256')
    .update(JSON.stringify(parseCharacterContent(value)))
    .digest('hex')
export function characterStage(
  chapter: number | null | undefined,
  relationship = ''
): keyof CharacterContent['stages'] {
  return chapter == null
    ? /本編で/.test(relationship)
      ? 'life'
      : 'meeting'
    : chapter <= 3
      ? 'meeting'
      : chapter <= 6
        ? 'date'
        : chapter <= 9
          ? 'honesty'
          : 'feelings'
}
export function characterDescription(
  snapshot: CharacterSnapshot,
  profile: KnowledgeProfile,
  story: StoryContext | null | undefined,
  examples = true
) {
  const c = snapshot.content
  return [
    `人物像：${c.profile.personality}`,
    `好きなこと：${c.profile.interests}`,
    c.profile.background && `背景：${c.profile.background}`,
    `大切なこと：${c.values.priorities}`,
    `嬉しい接し方：${c.values.welcomes}`,
    `戸惑う接し方：${c.values.discomfort}`,
    `話し方：${c.speech.tone} 一人称：${c.speech.firstPerson} ${c.speech.habits}`,
    `現在の段階：${c.stages[characterStage(story?.chapter, story?.relationship)]}`,
    `この場面の返信方針：${c.responses[profile].guidance}`,
    examples &&
      c.responses[profile].example &&
      `参考の言い方（そのまま繰り返さない）：${c.responses[profile].example}`,
    '人物の好みは採点条件にせず、場面・実際の会話・双方の意思を優先する。未来の関係や未記載の体験を作らない。'
  ]
    .filter(Boolean)
    .join('\n')
}
