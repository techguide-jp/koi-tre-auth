# 検索流入と公開入口の改善

## 調査と方針（2026-11-02）

本番は `https://app.koi-tre.com`。トップはHTTP 200だが、サイトマップ・canonical・OGPがない。`koi-tre.com` はAレコードがなく、`www` は旧Framerの404だった。Route 53にはルートではなく `@.koi-tre.com` のAが登録されていた。

Ubersuggest（日本・日本語、取得日2026-11-02）の推計は「初デート 会話」月1,600・難易度15、「マッチングアプリ 初対面 会話」月320・難易度15。履歴の最終月はそれぞれ2026-07、2026-05であり、最新月の実測ではない。対象サブドメインの推定検索訪問・キーワードは0。GA4のPVやGoogleのインデックス数を意味しない。

既存GA4画面の2026-01-01〜11-01は74セッション（Direct 48、Referral 23、Organic Search 3）。自己アクセス等を含む可能性があり、PVではない。改めてページとスクリーンを2026-10-05〜11-01の28日で表示すると19PV、アクティブユーザー6（トップ14PV、ログイン3PV、お問い合わせ1PV、練習1PV）。直近分には反映待ち・検証アクセスが含まれ得るため、実利用者数とは断定しない。GSC Wizardは契約制限、ローカルのGA4 API認証は権限不足で利用できなかった。Search Consoleの現在のアカウントの既存プロパティ一覧にはKoi-Treがなかった。

記事だけを大量に増やすより、特定の場面の例文と、すぐ使える道具を入口にする。初デート、マッチングアプリの初対面、沈黙の3記事を、異なる目的・具体例・練習課題で作る。登録不要の会話ネタ帳には場面別の聞き方・返し方を載せ、既存のAI練習へつなぐ。誇大な成功保証・架空の利用実績は載せない。

## 設計と実装計画

1. 既存の認証・DB・API・利用枠を変えず、静的な `/guides`、3記事、`/topics` を追加する。記事はサーバー描画し、各ページから関連ページと練習へ移動できるようにする。
2. 公開ページのtitle、description、canonical、OGPを共通化する。ログイン・練習・雛形・エラーはnoindex。サイトマップには公開ページだけを入れ、robots.txtで案内する。プライベートな会話IDを共有メタデータに出さない。
3. 既存DNSの必要レコードを退避し、ルートとwwwをVercelからappへ恒久転送する。旧www CNAMEを置換し、ルートAを追加する。NS・認証用CNAME・appのDNSは維持する。DNSの切り戻しは退避したJSONから行う。
4. 型チェック、lint、既存テスト、ビルド、SSRメタデータ・サイトマップ・404・モバイル操作・練習導線を確認する。Production環境のステージ済みデプロイを確認してから切り替え、本番とドメイン転送を検証する。

## 効果の判定

公開直後の検証アクセスは集客成果に数えない。公開から28日後に、GA4の新ページ別PV、検索経由セッション、ログイン・質問・練習完了を比較する。GA4の通常レポートには反映待ちがある。検索順位・PV増加を公開当日に達成済みとは扱わない。

広告は予算と採算の根拠がないため今回の施策に含めない。SNSへの投稿やDM送信は行わず、共有しやすい恒久URLとOGPを公開する。

## 参照

- [Google SEOスターターガイド](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [サイトマップ](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [正規URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [検索スパムポリシー](https://developers.google.com/search/docs/essentials/spam-policies)

## 実施・検証結果

- コード `5795db9`、Search Console確認ファイル `17332c4` を `codex/pv-growth` に保存・push。
- Production設定でステージした `dpl_BK2hfN59rwL6F7kBXdeZLKc88Zr2` を確認後、`https://app.koi-tre.com/` に昇格。SvelteKit、Node.js 24。Vercel側ビルドと404画面のビルド検証も成功。
- 型チェックはエラー・警告0、lint成功、既存55テスト成功、ビルド成功。追加のHTTPチェック `pnpm check:seo` で公開8ページの固有title・description・canonical・OGP、サイトマップ、ログイン・練習・雛形・404のnoindexを検証。切り替え後の本番でも通過。
- ローカル本番ビルドで390px幅のネタ帳・記事に横スクロールなし。カードの次表示、場面切り替え、沈黙の練習への引き継ぎを確認。記事からのリンクは趣味・休日のログイン画面へ遷移。本番1200pxでも横スクロールなし、趣味のカード切り替えと対応する練習リンクを確認。新しい本番タブのブラウザーエラーは0件。
- 本番の未認証APIは401、存在しないURLは404。質問送信・本番の利用枠消費は行っていない。追加計測は `topic_card_next` と `practice_cta_clicked`。固定の場面ID・記事IDだけを送り、会話や自由入力は含めない。
- 公開後10分のerror/fatalログ4件は404のみ（検証用の未知URL3件、Googleの別確認ファイルへのリクエスト1件）。確認範囲で5xx相当の例外なし。全期間・全リクエストの無障害を保証するものではない。
- Route 53変更 `C08319573PJ05H3SGO8VY` はINSYNC。ルートAは `216.150.1.1` / `216.150.16.1`、www CNAMEはVercelの推奨値。両ドメインをappへ308転送。権威DNS、Cloudflare DNS、Google DNSの応答を確認。TLS検証付きの接続先指定で両方の308とパス保持、通常のwww接続でも308を確認。ローカルDNSにはルートの古い否定応答が残るため、一部環境はキャッシュ反映待ち。
- DNS変更前はルートAなし、www CNAMEは `sites.framer.app`（TTL 300）。切り戻す場合は今回のルートAを削除し、wwwを元のCNAMEへ戻す。NS、app CNAME、旧 `@.koi-tre.com` A、認証用CNAMEは変更していない。元の全レコードは `/private/tmp/koitre-pv-growth/dns-before.json` に退避。
- Search Consoleに `https://app.koi-tre.com/` を追加し、HTMLファイルで所有権確認成功。`/sitemap.xml` の送信結果は「成功しました」、検出8ページ（2026-11-02）。確認用の `static/google36aa78f53b678ecd.html` は削除しない。検出数はインデックス登録済み数ではなく、検索パフォーマンスは処理待ち。

公開した入口：

- [会話ネタ帳](https://app.koi-tre.com/topics)
- [会話ガイド一覧](https://app.koi-tre.com/guides)
- [初デートの会話](https://app.koi-tre.com/guides/first-date-conversation)
- [マッチングアプリの初対面](https://app.koi-tre.com/guides/matching-app-first-meeting)
- [デート中の沈黙](https://app.koi-tre.com/guides/date-silence)
- [Search Console](https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fapp.koi-tre.com%2F)

PV増加と検索への掲載は未検証。公開前の19PVを基準に、まず28日間の自然な流入を見て判断する。

同日の追加改善として、女性も利用できる案内と、練習相手を男性・女性・指定なしから選ぶ導線を追加した（[仕様と検証](partner-choice.md)）。28日後の前後比較にはこの変更も含まれるため、変化を検索施策だけの効果と断定しない。
