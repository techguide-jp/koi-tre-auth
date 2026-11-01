# LP・チャットUIの見直し

2026-11-01

## 参照と方針

- [スピークバディ](https://app.speakbuddy.me/)：練習場面を絵で具体的に伝え、開始ボタンを明確にする構成を参考にした。
- [Cotomo](https://cotomo.ai/)：会話相手を名前で認識できる見せ方を参考にした。
- [cotree](https://cotree.jp/)：日本語での丁寧な説明、安心して始めるための情報の置き方を参考にした。

各社の画像・コピー・実績値は流用していない。日本向けの表現はデザイン上の仮説であり、利用者テストで検証した結果ではない。

明朝体の見出し、生成したカフェのイラスト、生成り色の背景と落ち着いた朱色で再構成。英語の飾り見出しを日本語にし、会話例→場面選択→ログインの導線とFAQを整えた。既存の月10回・3回返答の利用ルールは維持している。

## 会話相手

場面ごとに架空の相手を設定。初対面のカフェは「はる」、趣味・休日は「あおい」、デート中の沈黙は「りん」。場面選択・ログイン画面・チャットの紹介・発言者・入力欄に同じ呼び名を表示する。設定は共有の場面定義からDifyにも渡し、システム指示でも名前の一貫性を指定する。Googleのプロフィールから相手や利用者の属性を推測しない。

DB変更はない。既存の練習ID、発言、利用枠を保持する。

## 画像

組み込みの画像生成ツールを使用。公開用ファイルは `static/images/cafe-conversation.jpg`。元画像をJPEGへ変換した。プロンプトは以下。

```text
Use case: illustration-story
Asset type: hero illustration for Koi-Tre, a Japanese text conversation practice web app for first meetings and dates.
Primary request: A warm, carefully drawn editorial illustration for an adult Japanese audience. Two Japanese adults in their late twenties chatting comfortably across a small wooden table in a quiet neighborhood cafe in Japan. One in a muted sage shirt, the other in an oatmeal knit sweater, natural ordinary hairstyles. Cups of coffee, a small vase with one branch, window and a glimpse of trees. A moment of listening and small smiles, relaxed and sincere, not overly romantic.
Style/medium: hand-painted gouache and colored-pencil illustration in a refined Japanese lifestyle magazine. Fine uneven charcoal lines, visible paper grain, flat but tactile colors, simplified expressive faces. Sophisticated adult aesthetic, not childish, no anime, no 3D.
Composition/framing: landscape 4:3 composition, complete cafe scene. Figures occupy the central lower two thirds, a little airy space above. Scene gently tapers to warm off-white at outer margins so it sits naturally on a cream web page.
Lighting/mood: quiet afternoon daylight, reassuring and human.
Color palette: warm ivory #faf7f0, dusty terracotta #bd5a45, soft sage #9ba895, charcoal #343e39, natural wood. Restrained palette.
Constraints: No words, no letters, no logos, no UI, no speech bubbles, no watermark, no love hearts or sparkle motifs. Anatomically plausible hands, no photorealism.
```

## 検証

- 型チェック、lint、本番ビルド（404画面の検証を含む）を通過。
- 既存33件と会話相手のコンテキスト引き継ぎ3件の計36件を通過。
- 390px幅で横にはみ出さないこと、場面選択とログイン画面への引き継ぎを確認。
- Dify上で3場面を実行し、はる・あおい・りんがそれぞれ指定の名前で応答することを確認し、更新を公開。
- ローカルのFirebase Auth Emulator・PostgreSQL・模擬生成APIで、ログイン→相手名の表示→下書きを残して再読み込み→3回返答→振り返りまで確認。DB上も1練習・3発言・完了を確認した。Dify自体の呼び名は、上記の実モデル実行で別途検証している。
