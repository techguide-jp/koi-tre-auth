export const characters = [
  {
    id: 'aoi',
    name: 'あおい',
    gender: 'female',
    age: 25,
    subtitle: '小さな発見を、一緒に。',
    description:
      '散歩と写真が好き。穏やかだが、打ち解けると少しお茶目。相手のペースを大事にし、自分の好きな景色についても話す。',
    detail: 'いつもの道にも、つい寄り道したくなる。',
    color: 'sage'
  },
  {
    id: 'rin',
    name: 'りん',
    gender: 'female',
    age: 28,
    subtitle: '思ったことを、まっすぐに。',
    description:
      'ボードゲームと美術館が好き。率直で行動派だが、褒められると少し照れる。軽い冗談も言う。相手の考えを尊重し、自分と違う意見にも関心を持つ。',
    detail: '勝負には本気。でも、褒め言葉には弱い。',
    color: 'clay'
  },
  {
    id: 'shiori',
    name: 'しおり',
    gender: 'female',
    age: 31,
    subtitle: '静かな時間にも、物語がある。',
    description:
      '小説と静かなカフェが好き。自分のペースを大事にする落ち着いた人。好きな本の話では饒舌になる。自分の意見を持ち、同意を強要しない。',
    detail: '本の話をすると、いつもより少し饒舌。',
    color: 'night'
  },
  {
    id: 'yu',
    name: 'ゆう',
    gender: 'male',
    age: 26,
    subtitle: 'ゆっくり、知り合っていこう。',
    description:
      '映画とコーヒーが好き。穏やかで少し慎重。打ち解けると独特の冗談が出る。質問だけに頼らず自分の感じ方も話す。',
    detail: 'コーヒーは丁寧に、冗談は少し不器用に。',
    color: 'sage'
  },
  {
    id: 'sota',
    name: 'そうた',
    gender: 'male',
    age: 29,
    subtitle: '知らない楽しさを、見つけよう。',
    description:
      '新しいお店と音楽イベントが好き。好奇心旺盛でよく笑う。自分から話題を出すが、たまには話を聞いてほしい。相手の断りを尊重する。',
    detail: '初めてのお店には、ちょっとわくわくする。',
    color: 'clay'
  },
  {
    id: 'ren',
    name: 'れん',
    gender: 'male',
    age: 32,
    subtitle: '言葉は少しずつ、気持ちは丁寧に。',
    description:
      '料理と落ち着いた店が好き。口数は少なめだが、料理の話には熱が入る。沈黙も自然に過ごせる。相手の意思を確かめ、自分の希望も短く伝える。',
    detail: '好きな料理の話になると、つい熱が入る。',
    color: 'night'
  }
] as const
export type CharacterId = (typeof characters)[number]['id']
export type Character = (typeof characters)[number]
export type PartnerGender = 'male' | 'female'
export const missions = {
  feeling: {
    label: '自分の気持ちをひと言',
    instructions:
      '本人が今回の場面に合う自分の気持ち・感じ方を明示している。事実や活動名だけなら未達成。深い告白は求めない。'
  },
  preference: {
    label: '好きなところをひとつ伝える',
    instructions:
      '本人が好みの対象に加え、好きな点や理由をひとつ伝えている。未知の体験を追加する必要はない。'
  },
  receive: {
    label: '相手の大切な点を受け止める',
    instructions:
      '相手が明示した具体的な内容・気持ち・努力に、本人が反応している。単なる相づちだけなら未達成。賛同は必須ではない。'
  },
  invite: {
    label: '一緒にしたいことを伝える',
    instructions:
      '本人が一緒に過ごしたい希望と、相手が返答できる提案を伝えている。相手の承諾や好意は条件にしない。'
  },
  boundary: {
    label: '自分の希望をはっきり伝える',
    instructions:
      '本人が断る意思や今日は帰る等の自分の希望を明確に伝えている。謝罪・理由・代案は必須ではない。'
  },
  respect: {
    label: '相手の意思を受け止める',
    instructions: '相手の断り・保留を受け入れ、説得や再要求を止める意思を本人が言葉で示している。'
  },
  request: {
    label: 'してほしいことを具体的に',
    instructions:
      '本人が具体的な出来事について自分の気持ちと今後してほしい行動を、相手の人格を責めずに伝えている。'
  },
  calm: {
    label: '今の時間の心地よさを伝える',
    instructions:
      '本人が共有する場や静かな時間への具体的な感想、または落ち着いて過ごしたい意思を伝えている。話題や質問を増やす必要はない。'
  }
} as const
export type MissionId = keyof typeof missions
export type CoachingKind =
  | 'first_meeting'
  | 'interests'
  | 'silence'
  | 'invitation'
  | 'boundary'
  | 'conflict'
  | 'positive_event'
export interface Episode {
  id: string
  characterId?: CharacterId
  chapter?: number
  title: string
  subtitle: string
  setting: string
  opener: string
  coachingProfile: CoachingKind
  missionId: MissionId
  theme: 'cafe' | 'street' | 'books' | 'evening'
}
export const episodes: Episode[] = [
  {
    id: 'aoi-1',
    characterId: 'aoi',
    chapter: 1,
    title: '待ち合わせの、小さな発見',
    subtitle: '初めて会う日、花の咲く道で。',
    setting:
      '初めて二人で会う日の昼。カフェの前で待ち合わせ、道沿いの花が目に入った。無理のない深さで互いを知る。',
    opener:
      'はじめまして。来る途中、角のところに小さな花が咲いていたんです。ちょっと得した気分になっちゃいました。',
    coachingProfile: 'first_meeting',
    missionId: 'feeling',
    theme: 'street'
  },
  {
    id: 'aoi-2',
    characterId: 'aoi',
    chapter: 2,
    title: 'いつもの道の、知らない横顔',
    subtitle: '散歩の途中、気になる路地へ。',
    setting:
      'あおいとは一度会い、また昼の散歩をしている。古い路地に寄り道して、好きな風景や休日の楽しみ方を知り合う。',
    opener:
      'この路地、光の入り方が好きなんです。同じ道でも時間が違うと別の景色になるのが面白くて。',
    coachingProfile: 'interests',
    missionId: 'preference',
    theme: 'street'
  },
  {
    id: 'aoi-3',
    characterId: 'aoi',
    chapter: 3,
    title: '雨上がり、駅まであと5分',
    subtitle: 'もう少し話したい。その気持ちを。',
    setting:
      'あおいとの二回目のデートの帰り道。雨がやみ、駅まであと5分。自分がどう過ごしたいかを伝え、相手の意思も尊重する。',
    opener: '雨、やみましたね。もう少しだけ話したい気分なんだけど、駅まで少し遠回りしませんか？',
    coachingProfile: 'invitation',
    missionId: 'feeling',
    theme: 'evening'
  },
  {
    id: 'rin-1',
    characterId: 'rin',
    chapter: 1,
    title: 'はじめての、同じチーム',
    subtitle: 'ボードゲームのあと、ひと息。',
    setting:
      '友人の集まりで知り合ったりんと、ゲームが終わったあと初めて二人で話す。今日の感想や感じ方を無理なく伝える。',
    opener:
      'さっきのゲーム、最後までどきどきしたね。勝つのも好きだけど、みんなで笑えるのが一番楽しいかも。',
    coachingProfile: 'first_meeting',
    missionId: 'feeling',
    theme: 'cafe'
  },
  {
    id: 'rin-2',
    characterId: 'rin',
    chapter: 2,
    title: '褒められると、少し照れる',
    subtitle: '意外な一面を、見つけた。',
    setting:
      '二回目に会ったりんとカフェで話している。相手が人から褒められた出来事を話す。具体的に受け止め、自分の反応も伝える。',
    opener:
      'この前、ゲームの説明がわかりやすいって言われたんだ。うれしいけど、面と向かって褒められると照れるね。',
    coachingProfile: 'positive_event',
    missionId: 'receive',
    theme: 'cafe'
  },
  {
    id: 'rin-3',
    characterId: 'rin',
    chapter: 3,
    title: '次は、どこへ行こう',
    subtitle: '気になる展示へ、誘ってみる。',
    setting:
      'りんと二回楽しく会ったあと。駅のポスターに美術展がある。自分が一緒に行きたい気持ちや具体的な提案を伝える。',
    opener: 'この展示、色づかいが面白そう。ひとりでも行くけど、誰かと感想を話せたら楽しそうだね。',
    coachingProfile: 'invitation',
    missionId: 'invite',
    theme: 'street'
  },
  {
    id: 'shiori-1',
    characterId: 'shiori',
    chapter: 1,
    title: '同じ棚の前で',
    subtitle: '本屋で始まる、小さな会話。',
    setting:
      '知人の紹介で初めて会ったしおりと、待ち合わせ場所の本屋で話す。知らない作品を読んだふりはせず、自分の好みや関心を伝える。',
    opener:
      'この棚、つい足が止まってしまうんです。私は、登場人物の日常が丁寧に書かれた小説が好きで。',
    coachingProfile: 'first_meeting',
    missionId: 'preference',
    theme: 'books'
  },
  {
    id: 'shiori-2',
    characterId: 'shiori',
    chapter: 2,
    title: '感想が違っても、面白い',
    subtitle: '同じ物語に、違う見方。',
    setting:
      'しおりと作品の好みを話している。相手は余韻が残る結末が好きだが、本人の好みは自由。違いを否定せず、自分の感じ方も伝える。',
    opener:
      '私は、結末が全部はっきりしない物語も好きなんです。読み終わってから、自分で続きを考えられる気がして。',
    coachingProfile: 'interests',
    missionId: 'preference',
    theme: 'books'
  },
  {
    id: 'shiori-3',
    characterId: 'shiori',
    chapter: 3,
    title: 'ページを閉じた、そのあと',
    subtitle: '静けさも、一緒に楽しむ。',
    setting:
      'しおりと落ち着いたカフェでそれぞれ本を読んだあと。無理に話を増やさず、共有する時間や自分の感じ方を伝える。',
    opener:
      '……少し静かに過ごせて、落ち着きました。誰かと一緒でも、こういう時間があるのっていいですね。',
    coachingProfile: 'silence',
    missionId: 'calm',
    theme: 'cafe'
  },
  {
    id: 'yu-1',
    characterId: 'yu',
    chapter: 1,
    title: 'コーヒーが冷める前に',
    subtitle: '最初のひと言を、ゆっくり。',
    setting:
      '初めて二人で会うゆうとカフェにいる。緊張していてもよく、自分の好みや今の気持ちを少し伝える。',
    opener:
      'はじめまして。ここのコーヒー、香りがいいですね。初めての場所だと少し緊張するけど、なんだか落ち着きます。',
    coachingProfile: 'first_meeting',
    missionId: 'feeling',
    theme: 'cafe'
  },
  {
    id: 'yu-2',
    characterId: 'yu',
    chapter: 2,
    title: '好きな物語の話をしよう',
    subtitle: '作品の向こうに、好みが見える。',
    setting:
      'ゆうと二度目に会い、映画や物語の好みについて話している。作品名や知識だけでなく、好きな点や感じ方を知り合う。',
    opener:
      '映画は、派手な展開より人が少しずつ変わる話に惹かれるんです。見終わってから、じわっと残るような。',
    coachingProfile: 'interests',
    missionId: 'preference',
    theme: 'cafe'
  },
  {
    id: 'yu-3',
    characterId: 'yu',
    chapter: 3,
    title: 'また会いたい、の伝え方',
    subtitle: '帰り際、次の約束へ。',
    setting:
      'ゆうとの二回目のデートが終わるところ。自分がまた会いたいなら具体的に誘い、相手が返事を選べるようにする。',
    opener: '今日は、ゆっくり話せてよかったです。……気づいたら、もうこんな時間でしたね。',
    coachingProfile: 'invitation',
    missionId: 'invite',
    theme: 'evening'
  },
  {
    id: 'sota-1',
    characterId: 'sota',
    chapter: 1,
    title: '気になっていた、お店で',
    subtitle: '初めて同士の、わくわく。',
    setting:
      'そうたと初めて二人で来た新しいカフェ。目の前のことに触れ、自分の好みや感じ方を自然に伝える。',
    opener:
      'ここの雰囲気、思ってたより落ち着くね。新しいお店って、入る前のちょっとしたわくわくが好きなんだ。',
    coachingProfile: 'first_meeting',
    missionId: 'feeling',
    theme: 'cafe'
  },
  {
    id: 'sota-2',
    characterId: 'sota',
    chapter: 2,
    title: '聞いてほしい、今日のこと',
    subtitle: '楽しかった気持ちを、分け合う。',
    setting:
      'そうたが初めて参加した音楽イベントの話をしている。本人の体験は作らず、相手が楽しかった具体的な点を受け止める。',
    opener:
      '昨日の音楽イベント、すごくよかった！ 知らない曲ばかりだったのに、最後は会場が一体になる感じがして。',
    coachingProfile: 'positive_event',
    missionId: 'receive',
    theme: 'evening'
  },
  {
    id: 'sota-3',
    characterId: 'sota',
    chapter: 3,
    title: '次の週末、ふたりなら',
    subtitle: '気になる場所へ、誘ってみる。',
    setting:
      'そうたと何度か話し、週末の予定の話になった。自分が一緒にしたいことを具体的に提案する。相手の都合や希望を尊重する。',
    opener:
      '来週末、ちょっと時間があるんだ。出かけるのもいいし、のんびりするのもいいなって思ってる。',
    coachingProfile: 'invitation',
    missionId: 'invite',
    theme: 'street'
  },
  {
    id: 'ren-1',
    characterId: 'ren',
    chapter: 1,
    title: 'おいしい、から始めよう',
    subtitle: '初めての食事、小さな感想。',
    setting: 'れんと初めて二人で食事をする。目の前の料理や店に触れ、自分の感想を短くても伝える。',
    opener: 'このスープ、いい香りですね。初めて来た店だけど、ゆっくり食べられそうでよかった。',
    coachingProfile: 'first_meeting',
    missionId: 'feeling',
    theme: 'cafe'
  },
  {
    id: 'ren-2',
    characterId: 'ren',
    chapter: 2,
    title: '好きな味には、理由がある',
    subtitle: '料理の話で、少し饒舌に。',
    setting:
      'れんと二回目の食事。相手の料理の好みをきっかけに、本人も自分の好きなところや感じ方を伝える。料理経験を作る必要はない。',
    opener:
      '煮込み料理って、時間をかけたぶん味がまとまるのが面白いんです。待っている時間も、けっこう好きで。',
    coachingProfile: 'interests',
    missionId: 'preference',
    theme: 'cafe'
  },
  {
    id: 'ren-3',
    characterId: 'ren',
    chapter: 3,
    title: '言葉の少ない、いい時間',
    subtitle: '急がずに、心地よさを伝える。',
    setting:
      'れんとの食事が終わり、窓の外を一緒に眺めている。沈黙を埋める義務はなく、共有する時間への気持ちを伝える。',
    opener: '……おいしかったですね。食事のあと、こうして少しのんびりするのもいいな。',
    coachingProfile: 'silence',
    missionId: 'calm',
    theme: 'evening'
  },
  {
    id: 'shared-invite',
    title: '気になっていた場所へ',
    subtitle: '行ってみたい、を一緒に。',
    setting:
      '何度か会っている相手と、次に出かける場所の話をしている。本人の希望を伝え、返事を自由に選べる誘い方を練習する。',
    opener: 'このあたり、まだ知らない場所が多いんです。次に出かけるなら、どんなところがいいかな。',
    coachingProfile: 'invitation',
    missionId: 'invite',
    theme: 'street'
  },
  {
    id: 'shared-boundary',
    title: '今日は、ここまで',
    subtitle: '自分の希望を、大事にする。',
    setting:
      'デートの帰り際、相手はもう一軒寄りたそうだが、本人は今日は帰りたい。短くても自分の意思を伝える。相手は一度確認しても、明確な断りを尊重する。',
    opener: 'もう一軒、寄っていきませんか？ でも、今日は疲れていたら遠慮なく言ってくださいね。',
    coachingProfile: 'boundary',
    missionId: 'boundary',
    theme: 'evening'
  },
  {
    id: 'shared-respect',
    title: '返事が、思ったのと違ったら',
    subtitle: '相手のペースを、受け止める。',
    setting:
      '本人が次の週末に誘ったが、相手は忙しくて難しいと伝えている。断りを受け入れ、無理な説得をせず自然に終える。',
    opener: '誘ってくれてありがとう。でも、来週末は予定が詰まっていて、会うのは難しそうです。',
    coachingProfile: 'boundary',
    missionId: 'respect',
    theme: 'cafe'
  },
  {
    id: 'shared-plan',
    title: 'すれ違いを、言葉にする',
    subtitle: '困った気持ちと、してほしいこと。',
    setting:
      'この場面では交際中の二人。相手が直前に予定を変更して、本人は困っている。具体的な出来事・自分の気持ち・今後の希望を、人格を責めず伝える。',
    opener: '昨日は、急な仕事で予定を変えてしまってごめんね。ちゃんと話しておきたいと思って。',
    coachingProfile: 'conflict',
    missionId: 'request',
    theme: 'cafe'
  },
  {
    id: 'shared-news',
    title: '「受かったよ！」の、そのあと',
    subtitle: '頑張りが実った日を、一緒に。',
    setting:
      '勉強を続けていた相手が資格試験に受かったと知らせてくれた。相手の喜びや努力を具体的に受け止める。本人の実績へ話を変える必要はない。',
    opener:
      '聞いてください。試験、受かったんです！ 仕事のあとに勉強を続けてきたから、やっとほっとしました。',
    coachingProfile: 'positive_event',
    missionId: 'receive',
    theme: 'street'
  },
  {
    id: 'shared-silence',
    title: '話さない時間も、心地よく',
    subtitle: '目の前の景色を、一緒に。',
    setting:
      '気心が少し知れた相手と、食事のあとに静かに過ごしている。目の前の雰囲気や落ち着いた時間への気持ちを自然に伝える。',
    opener: '……ここの音楽、落ち着きますね。窓の外を眺めているだけでも、いい時間だな。',
    coachingProfile: 'silence',
    missionId: 'calm',
    theme: 'evening'
  }
]
