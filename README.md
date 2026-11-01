# koi-tre-auth

**koi-tre-auth** は、koi-tre の認証機能とアプリケーション API を提供する SvelteKit プロジェクトです。
Firebase 認証、Drizzle、PostgreSQL を使って Dify アプリ連携用の API と利用履歴管理を提供します。

## Features

- **SvelteKit** をベースにした最新のフロントエンド開発環境
- Firebase を用いた認証機能
- 3場面・3ターンの会話練習と、発言に合わせた振り返り
- 月10回の練習枠、途中再開、二重送信防止
- Drizzle + PostgreSQL を利用したデータベース連携
- Dify アプリから利用する内部 API
- Vercel をデプロイ先として利用（現状は手動デプロイ）
- ESLint と Prettier によるコードフォーマットと静的解析

## Prerequisites

- [Node.js](https://nodejs.org/) v20 以上
- pnpm
- PostgreSQL
- Firebase プロジェクト設定

## Getting Started

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-username/koi-tre-auth.git
cd koi-tre-auth
```

### 2. 依存パッケージのインストール

```bash
pnpm install
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成し、Firebase / Firebase Admin / PostgreSQL / Dify API トークン / Dify アクセスキー署名シークレットを設定してください。

> **注意:** 各サービスのキーやドメインは、実際の値に置き換えてください。

### 4. ローカル DB のセットアップ

```bash
createdb koitre
pnpm db:migrate
```

新規環境はmigrationだけで利用できます。旧データを取り込む場合の `db:setup` は migration 適用後に `db_cluster-13-07-2025@01-16-45.neon-ready-no-connect.sql` から `public.users` と `public.operations` の seed を投入します。

DB 系コマンドは通常 `.env` を読み込みます。production 向けには `NODE_ENV=production` を指定した別スクリプトを用意しており、`.env.production` を読み込んで実行します。

```bash
pnpm db:reset
pnpm db:status
pnpm db:generate:prod
pnpm db:reset:prod
pnpm db:status:prod
pnpm db:migrate:prod
pnpm db:seed:prod
pnpm db:setup:prod
```

### 5. 開発サーバーの起動

開発サーバーを起動して、ローカル環境で動作を確認します。

```bash
pnpm dev
```

ブラウザで [http://localhost:5173](http://localhost:5173) を開いて、アプリケーションを確認してください。

## 新しい練習画面

`dify/koi-tre-practice.yml` を別のDify Workflowアプリへインポートし、モデル認証を確認して公開します。サーバー用の `DIFY_PRACTICE_API_KEY` を設定し、migration・生成テストを終えた環境で `PRACTICE_ENABLED=true` にすると新画面へ切り替わります。

最初の返答の保存成功で1練習を消費し、3回の返答と振り返りまでを1回と数えます。日本時間の月ごとに10回で、途中の練習の再開には追加消費しません。旧履歴は保持します。詳細なAPI・検証・公開・切り戻し手順は [初回練習の仕様と公開手順](docs/practice-release.md) を参照してください。

## 旧Dify連携の設定確認

Dify ワークフローに設定する項目は、次のコマンドで確認できます。

```bash
pnpm dify:config
```

Bearer トークンを実値で表示したい場合は、次を実行してください。

```bash
pnpm dify:config -- --show-secrets
```

## GA4 で利用状況を確認する

既存の Firebase Analytics を使い、本番ドメイン（`app.koi-tre.com` / `www.koi-tre.com` / `koi-tre.com`）でのみ送信します。開発・Vercel Preview は集計対象外です。

| 確認したいこと                           | イベント名            | 指標         |
| ---------------------------------------- | --------------------- | ------------ |
| アクセスした人数                         | `page_view`           | 総ユーザー数 |
| ログイン状態で利用した人数（再訪を含む） | `authenticated_visit` | 総ユーザー数 |
| ログイン操作を完了した人数               | `login`               | 総ユーザー数 |
| 新規登録した人数                         | `sign_up`             | 総ユーザー数 |
| 1 回以上質問した人数                     | `question_submitted`  | 総ユーザー数 |
| 質問回数                                 | `question_submitted`  | イベント数   |
| 3ターンの練習を完了した人数              | `practice_completed`  | 総ユーザー数 |

GA4 のイベントレポートで期間を指定し、各イベントの「総ユーザー数」を比較してください。「イベント数」は同じ人の繰り返し利用も数えます。「探索 → ファネルデータ探索」で `page_view → authenticated_visit → question_submitted` を条件にすると、質問に至るまでの利用状況を比較できます。期間前にログインした再訪者を落とさないよう、`login` と `authenticated_visit` は分けています。

設定済みの [Koi-Tre 利用状況（訪問・ログイン・質問）](https://analytics.google.com/analytics/web/#/analysis/a312696206p439720447/edit/4kk5Vx4fT4KEAZ845_Cqeg) では、初期期間を「今月」とし、対象イベントの総ユーザー数とイベント数を一覧できます。計測開始前や GA4 の反映待ちで行がない場合は、実際の利用ゼロとは見なしません。

User-ID には Firebase UID の SHA-256 値を使い、メール・氏名・質問文・回答・アクセスキーは送信しません。URL の検索パラメーターとフラグメントも除きます。ログアウト時には User-ID を解除します。GA4 は氏名・メールを表示する顧客一覧ではありません。

### 必要な設定

1. Firebase に紐づく既存の Web ストリームを使います。本番で確認したプロパティ ID は `439720447`、ストリーム ID は `8117211599`、計測 ID は `G-WSZMFRPKKP` です。`VITE_MEASUREMENT_ID` をこのストリームと揃えてください。
2. GA4 の「管理 → データストリーム → 対象 Web ストリーム → Measurement Protocol API シークレット」でサーバー送信用シークレットを作成します。値は Vercel の **Production** に `GA4_API_SECRET` として保存します。ブラウザ用の `VITE_` 変数、Git、チャットには書かないでください。
3. 自動ページビューの二重計測を避けるため、対象ストリームの拡張計測で「ブラウザの履歴イベントに基づくページの変更」をオフにします。初回を含むページビューは `src/routes/+layout.svelte` の `afterNavigate` から送信します。
4. `question_submitted` をキーイベントにします。イベントごとに 1 回数え、人数を見る際は「総ユーザー数」を選びます。
5. 環境変数を設定した後で、本番へデプロイします。新しい練習画面ではアクセスキーのコピーは不要です。旧画面を使う場合は、質問計測に計測情報を含む新しいキーが必要です。

### GA4 管理 CLI

Google 公式の `@google-analytics/admin` を使う `scripts/ga-admin.mjs` を用意しています。通常は `.env`、`NODE_ENV=production` を付けた場合は `.env.production` を読みます。

設定するのは `GA4_PROPERTY_ID`（数値）、`VITE_MEASUREMENT_ID`、GA4 編集権限のある認証です。`GOOGLE_APPLICATION_CREDENTIALS` を指定した場合はその認証を使い、それ以外は Firebase Admin の既存サービスアカウントを使います。権限のある Application Default Credentials を使う場合は `GA4_USE_ADC=true` にします。必要に応じて `GA4_QUOTA_PROJECT_ID` を設定してください。認証に使う Google Cloud プロジェクトでは Google Analytics Admin API を有効にする必要があります。Firebase 認証の管理権限と GA4 編集権限は別です。

```bash
pnpm ga:list
pnpm ga:sync:dry
pnpm ga:sync
NODE_ENV=production pnpm ga:list
```

`ga:list` はプロパティ・ストリーム・キーイベント・履歴ページビュー設定と、シークレットの設定有無を確認します。プロパティ ID が未設定の場合は閲覧可能なプロパティを列挙します。`ga:sync:dry` は変更予定だけ表示し、`ga:sync` は不足している `question_submitted` キーイベントを追加し、履歴変更による自動ページビューをオフにします。シークレット値は表示しません。GA4 側のシークレット作成と Vercel への登録は別途必要です。

### 検証と計測の範囲

- ページの初回表示と SPA 遷移で `page_view` が各 1 件だけ送られることを Network の `g/collect` で確認します。
- ボタンによるログインで `login`、ログイン状態の復元で `authenticated_visit`、ログアウト後のイベントで User-ID が解除されることを確認します。
- 新しい練習と旧Dify連携のどちらも、DB保存成功後に `src/lib/server/analytics.ts` から Measurement Protocol で送信します。新しい練習の3回目の保存では `practice_completed` も送信します。保存失敗・利用上限・重複再送は数えません。計測失敗が質問保存を失敗に変えることもありません。
- サーバー送信はブラウザ由来の client ID がある場合のみ行います。広告ブロック等で取得できない場合は送信せず、架空の ID は作りません。質問イベントは人数・回数用で、滞在時間はブラウザ計測を使います。
- `GA4_API_SECRET` 未設定の間は質問イベントを送信できません。HTTP 2xx は受付の確認であり、GA4 の検証エンドポイントとリアルタイム／DebugView も確認してください。設定済み GA4 のイベント名を登録するだけでは送信検証の代わりにはなりません。
- 過去の未計測ログイン・質問は GA4 に復元しません。GA4 の未計測と実際のゼロ件を区別してください。Cookie 削除・複数端末・ブロック・通信失敗により、Neon の保存件数と GA4 は一致しない場合があります。通常レポートへの反映には時間がかかるため、まずリアルタイムで確認します。

詳細は [計測設計・実装計画](docs/ga4-usage-measurement.md) を参照してください。

## 公開ページと集客

登録不要の会話ネタ帳は `/topics`、会話ガイド一覧は `/guides` です。記事は `src/lib/content/guides.ts`、話題カードは `src/lib/content/topics.ts` で管理します。公開メタデータとサイトマップの対象URLは `src/lib/seo.ts` を使います。ログイン・練習・雛形・エラーページは検索対象外です。

本番ビルドのプレビューを起動した状態で `pnpm check:seo` を実行すると、公開ページのSSRメタデータ、サイトマップ、noindex、404を検証できます。別の環境は `pnpm check:seo https://app.koi-tre.com` のように指定します。HTTP取得のみで、GA4イベントや質問は送信しません。調査・施策・効果判定は [検索流入と公開入口の改善](docs/pv-growth.md) を参照してください。

## Code Quality

コードのフォーマットや静的解析には ESLint と Prettier を使用しています。
以下のコマンドでチェックを実行できます。

```bash
pnpm lint
```

## Building for Production

本番用ビルドを作成するには、以下のコマンドを実行します。

```bash
pnpm build
```

ビルド後、以下のコマンドでローカルプレビューが可能です。

```bash
pnpm preview
```

## Deployment

公式の `@sveltejs/adapter-vercel` 5.10.3 を使い、ランタイムを `nodejs24.x` に固定しています。旧 `adapter-auto` が自動導入する Vercel アダプターは Node.js 24 に対応しないため使用しません。

本プロジェクトでは、Vercel をデプロイ先として利用していますが、現状自動デプロイの設定は行っていません。
Vercel の管理画面から手動でデプロイするか、今後 GitHub Actions などを用いて自動デプロイを実装してください。

## CI/CD

プロジェクトには GitHub Actions を利用した CI ワークフローも用意されています。
現状ではコードの静的解析やテストを実行する設定となっています。

## Contributing

バグ修正や機能追加の提案は大歓迎です。
プルリクエストを送る前に、まず Issue で議論していただけると助かります。

## License

[MIT License](LICENSE)

---

Happy Coding!
