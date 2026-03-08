# koi-tre-auth

**koi-tre-auth** は、koi-tre の認証機能とアプリケーション API を提供する SvelteKit プロジェクトです。
Firebase 認証、Drizzle、PostgreSQL を使って Dify アプリ連携用の API と利用履歴管理を提供します。

## Features

- **SvelteKit** をベースにした最新のフロントエンド開発環境
- Firebase を用いた認証機能
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

`.env.sample` をコピーして `.env` ファイルを作成し、Firebase / Firebase Admin / PostgreSQL / Dify API トークン / Dify アクセスキー署名シークレットを設定してください。

> **注意:** 各サービスのキーやドメインは、実際の値に置き換えてください。

### 4. ローカル DB のセットアップ

```bash
createdb koitre
pnpm db:setup
```

`db:setup` は migration 適用後に `db_cluster-13-07-2025@01-16-45.neon-ready-no-connect.sql` から `public.users` と `public.operations` の seed を投入します。

DB 系コマンドは通常 `.env` を読み込みます。production 向けには `NODE_ENV=production` を指定した別スクリプトを用意しており、`.env.production` を読み込んで実行します。

```bash
pnpm db:status
pnpm db:generate:prod
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

## Dify 設定確認

Dify ワークフローに設定する項目は、次のコマンドで確認できます。

```bash
pnpm dify:config
```

Bearer トークンを実値で表示したい場合は、次を実行してください。

```bash
pnpm dify:config -- --show-secrets
```

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
