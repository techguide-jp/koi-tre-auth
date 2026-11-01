export const topicCategories = [
  { id: 'opening', label: '初対面・待ち合わせ', scene: 'cafe' },
  { id: 'hobbies', label: '趣味・休日', scene: 'hobbies' },
  { id: 'silence', label: '食事中・沈黙したとき', scene: 'silence' }
] as const

export type TopicCategory = (typeof topicCategories)[number]['id']

export interface Topic {
  category: TopicCategory
  title: string
  question: string
  self: string
  followUp: string
}

export const topics: Topic[] = [
  {
    category: 'opening',
    title: 'お店の雰囲気',
    question: 'このお店、落ち着きますね。こういう雰囲気のお店はよく来ますか？',
    self: '私は静かなお店だと、ついゆっくりしてしまいます。',
    followUp:
      '「よく行く」と返ってきたら、どんなところが好きか聞いてみる。詳しい場所まで聞かなくても大丈夫。'
  },
  {
    category: 'opening',
    title: 'メニューを選ぶ',
    question: 'どの飲み物が気になりますか？',
    self: '私は今日は温かいお茶にしようかなと思っています。',
    followUp: '選んだものに「いいですね」と反応して、普段も好きなのかを一つ聞いてみる。'
  },
  {
    category: 'opening',
    title: '今日の街',
    question: 'このあたりを歩くことはありますか？',
    self: '私はあまり来ないので、さっき少し周りを見ていました。',
    followUp:
      '詳しければ街の好きなところへ。初めてなら、二人で気になった景色の話に。自宅の場所は聞かない。'
  },
  {
    category: 'opening',
    title: '気になっていた話',
    question: '前に話していた映画のこと、もう少し聞いてもいいですか？',
    self: '私も作品を探していたので、気になっていました。',
    followUp:
      '実際に聞いたことのある話題に置き換える。内容より、相手がどんなところを楽しんだかに注目する。'
  },
  {
    category: 'opening',
    title: '少し緊張しているとき',
    question: '私は少し緊張しています。ゆっくり話せたらうれしいです。まず飲み物を選びましょうか。',
    self: '気の利いたことを言おうとすると、考えすぎてしまうんです。',
    followUp: '相手にも緊張していると言わせる必要はない。注文や席のことなど、今できることへ戻る。'
  },
  {
    category: 'opening',
    title: '最近のお休み',
    question: '最近のお休みは、どんなふうに過ごしましたか？',
    self: '私は家で料理をして、のんびりしていました。',
    followUp:
      '外出でも家でも、出てきた過ごし方に一度反応する。「何もしなかった」もそのまま受け止める。'
  },
  {
    category: 'hobbies',
    title: '家での楽しみ',
    question: '家でゆっくりするとき、何をしていることが多いですか？',
    self: '私は音楽を流しながら、お茶を飲むのが好きです。',
    followUp: '映画・料理・ゲームなど、返答に出たものを一つ拾って、最近楽しかったことを聞く。'
  },
  {
    category: 'hobbies',
    title: '最近おいしかったもの',
    question: '最近食べて、おいしかったものはありますか？',
    self: '私は近所で買った焼きたてのパンが印象に残っています。',
    followUp: '好きな味や食べ方へ。値段や店の詳しい場所を知らなくても、感想を聞ける。'
  },
  {
    category: 'hobbies',
    title: '繰り返し楽しむもの',
    question: '何度も見たり聞いたりしている作品はありますか？',
    self: '私は好きな映画を、気分を変えたいときに見返しています。',
    followUp: '知らない作品なら、知っているふりをせず「どんなところが好きですか？」と聞いてみる。'
  },
  {
    category: 'hobbies',
    title: '散歩の楽しみ',
    question: '散歩するとしたら、行き先を決めるほうですか？',
    self: '私はお店を一つ決めて、途中で寄り道することが多いです。',
    followUp: '同じなら共感を、違うならその楽しみ方への関心を添える。どちらがよいかは決めない。'
  },
  {
    category: 'hobbies',
    title: '小さな予定',
    question: '最近、ちょっと楽しみにしていることはありますか？',
    self: '私は週末に、気になっていたお菓子を作ってみようと思っています。',
    followUp: '大きな夢や目標を求めず、小さな予定でもその楽しみな点を聞いてみる。'
  },
  {
    category: 'hobbies',
    title: 'やってみたいこと',
    question: '時間ができたら、少しやってみたいことはありますか？',
    self: '私は写真を、もう少しゆっくり撮ってみたいです。',
    followUp: 'きっかけや気になっている点へ。「特にない」なら無理に答えを探してもらわず、別の話に。'
  },
  {
    category: 'silence',
    title: '今日いちばんの一皿',
    question: '今日の料理だと、どれが一番気に入りましたか？',
    self: '私はスープが好きでした。香りがよかったですね。',
    followUp: '相手が選んだ料理の感想を聞く。食べている間は、返事を待ってゆっくり話す。'
  },
  {
    category: 'silence',
    title: '飲み物でひと息',
    question: '少しゆっくり飲みましょうか。このお茶、香りがいいですね。',
    self: '私は温かい飲み物があると、ほっとします。',
    followUp: '質問を足さず、一緒に味わう時間にしてもよい。沈黙を必ず埋める必要はない。'
  },
  {
    category: 'silence',
    title: 'さっきの話の続き',
    question: 'さっき話していた散歩のこと、もう少し聞いてもいいですか？',
    self: '寄り道するのが楽しそうだなと思っていました。',
    followUp: '実際に出た話題に置き換える。相手が話したくなさそうだった話は、もう一度聞かない。'
  },
  {
    category: 'silence',
    title: '目の前の景色',
    question: '窓からの景色、きれいですね。季節を感じる場所は好きですか？',
    self: '私は木の色が変わってくる時期に、よく外を歩きたくなります。',
    followUp: '実際に見えているものに置き換える。相手の感想を聞き、自分が気づいたことを一つ返す。'
  },
  {
    category: 'silence',
    title: '休憩を相談する',
    question: '少し歩きますか？それとも、ここでゆっくりしますか？',
    self: '私はどちらでも大丈夫なので、気分に合わせられたらうれしいです。',
    followUp: '相手の希望を聞く。自分の希望があるなら、それも伝える。二択以外の答えでも大丈夫。'
  },
  {
    category: 'silence',
    title: '帰り際に伝える',
    question:
      '今日はありがとうございました。お話しできてうれしかったです。そろそろ行きましょうか。',
    self: '特に、お休みの日の話が聞けて楽しかったです。',
    followUp:
      '楽しかった話は、実際の内容に変える。次の約束や返事を、その場で無理に決めてもらわない。'
  }
]
