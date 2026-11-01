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

実装・公開後に追記する。
