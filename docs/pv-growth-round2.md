# 紹介導線・追加記事・30秒お試し

## 方針と実装計画（2026-11-02）

ユーザー承認済みの順序で、紹介素材と導線、電話・2回目のデートの記事、登録不要のお試しを追加する。既存のSvelteKit・静的公開ページ・GA4を利用し、DB・認証・AIの利用枠は変更しない。

1. `/share` にSNS画像3枚、コピー可能な投稿文、イベント向けのQR付きA4案内を公開する。紹介用リンクは固定のcampaign/source/medium/contentだけを許可し、既存のURL匿名化を維持したままGA4へ渡す。素材ダウンロードとコピー操作も計測する。
2. `/guides/matching-app-phone-topics` と `/guides/second-date-conversation` を追加する。電話の開始・沈黙・終了、前回の話を拾う・新しい話題・次の約束を、それぞれ異なる例文で扱う。電話機能や恋愛成果は約束しない。目次・関連リンク・sitemapに反映する。
3. `/try` に架空の会話から返し方を選ぶ3問のお試しを公開する。採点や性格診断はせず、選択ごとの言い換えと理由を示す。入力・ログイン・AI通信なし。完了後に関連ガイド・AI練習・共有へ案内する。開始・選択・完了を計測する。

コピーには処理中・成功・失敗と手動コピーの案内を表示する。画像・PDFの見た目とQRの復号、390px/デスクトップの操作、型・lint・既存テスト・build・HTTPのSEO検証を確認し、Production環境でステージ後に本番へ昇格する。

## 紹介の範囲

指定されたSNSアカウントや送信先はないため、今回の実施範囲は公開済みの紹介素材・共有操作・計測可能なリンクまでとする。第三者へのメール・DM・SNS投稿やイベント参加者への送信を、素材作成の完了として扱わない。広告費は使用しない。

## 効果の測定

GA4ではcampaign `conversation_202611` のセッション・利用者・入口ページと、練習開始導線/質問送信を確認する。コピーや素材取得は紹介準備の操作であり、投稿・紹介・新規訪問の実績ではない。お試しは1ページ内で進行し、回答ごとの人工的なPVは追加しない。

11月30日の28日後レポートではこの追加施策も変更履歴として扱い、検索施策・紹介・お試しの効果を区別する。公開時点ではPV増加を達成済みとは報告しない。

## 実装とローカル検証

- 紹介画像は1080×1350のPNG 3枚。QR単体PNGとA4 1ページPDFを作成し、全画像とPDFのレンダリングを目視確認。PDFはNoto Sans JPを埋め込み、日本語テキストも抽出できる。QR単体・A4プレビューの両方を復号し、campaign付きの会話ネタ帳URLと一致することを確認。
- `/share` のX・Instagram・紹介サイトの切り替えで3件すべてのリンクが更新され、投稿文・紹介文のコピーを確認。検証でSvelteの関数内の依存が更新に反映されない箇所を修正。コピー完了表示は対象の文章が変わると解除する。
- `/try` の3問×3選択の全9解説、完了画面、再試行、共有リンクのコピーをブラウザーで確認。共有リンクに回答は入らない。ガイドへのリンクと相手・場面を選ぶ練習導線も確認。
- 390px幅で紹介・お試し・新記事に横はみ出しなし。1200px幅の新記事も確認。
- 型チェックはエラー・警告0、lint成功、72テスト成功、ビルドとVercel 404出力チェック成功。既存のプライバシー検証に、固定UTMだけを許可し、個人情報混在・改変UTM・referrerを匿名化するケースを追加。HTTPで公開12ページのSSR title/description/canonical/OGP・サイトマップ・非公開/404のnoindexを確認。
- 本番の練習作成や質問送信は行わない。外部SNSへの投稿・個別配信・広告出稿はしていない。

## 素材の再生成

`scripts/build-promotion-assets.py --pdf-font /path/to/NotoSansJP-Regular.ttf` を使用。Pillow・reportlab・Popplerが必要。SNS用にはmacOS標準のヒラギノ角ゴシックW3/W6を使う。PDFには[Google Fonts公式のNoto Sans JP](https://github.com/google/fonts/tree/main/ofl/notosansjp)をweight 400にしたTrueTypeを埋め込む。生成用のフォント本体をアプリへ追加する必要はない。

## 本番公開・受信の確認

- 実装 `87dc5a0`、PDFプレビューの直接遷移修正 `4c0148f` を `codex/pv-growth-distribution` に保存・pushした。VercelのProduction設定でステージし、対象コミットと新設4ページを確認してから公開。最終デプロイ `dpl_G6DzQ9XAC1n95WhGeJGh6DoE9oY5` はREADY、`https://app.koi-tre.com/` の参照先とコミットも確認した。
- 本番で公開12ページのSEOチェックが成功。紹介素材6ファイル（PNG 5枚・PDF 1件）のHTTP 200、ファイル形式、Content-Typeを確認。ブラウザーでもPDFの実ダウンロード、投稿文コピー、お試しの完了・共有を確認した。PDFを見るリンクには `data-sveltekit-reload` を付け、SvelteKitのページとして先読み・遷移しないようにした。
- GA4プロパティ439720447のリアルタイム画面で `quick_try_started`・`quick_try_answered`・`quick_try_completed`・`quick_try_shared`・`promotion_copy`・`promotion_download` の受信を確認。`page_view` の `page_location` を開き、`/try?utm_source=visitor&utm_medium=share&utm_campaign=conversation_202611&utm_content=quick_try` と `/share` が届いていることも確認した。
- この検証でアクセス・イベントを発生させているため、公開直後の数値を集客成果に数えない。後日のレポートで自己アクセスを確実に識別できない場合は混入の限界を示す。最終デプロイの公開後ログ（2026-11-02 04:46:24〜04:56:24 UTC、error/fatal、最大20件）には該当ログなし。静的配信を含む全リクエストの無障害を保証するものではない。
- 既存の自動測定 `koi-tre-28` を更新し、5記事・`/share`・`/try`、紹介campaign、紹介素材とお試しのイベントを対象に追加。2026-11-30 09:00 JST、一度のみ、読み取り専用の条件は維持した。素材取得・コピーと新規流入、お試し完了とAI練習完了を区別して報告する。

公開URL：

- https://app.koi-tre.com/share
- https://app.koi-tre.com/guides/matching-app-phone-topics
- https://app.koi-tre.com/guides/second-date-conversation
- https://app.koi-tre.com/try

外部SNSアカウントや送信先は指定されておらず、リポジトリにも公式アカウントの案内は見つからなかった。今回完了した紹介施策は、誰でも使える素材・共有操作・測定付きの導線の公開まで。外部SNSへの投稿・イベント参加者等への送信は未実施。
