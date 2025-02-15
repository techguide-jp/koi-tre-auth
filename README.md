# koi-tre-auth

**koi-tre-auth** は、koi-tre の認証機能とアプリケーション部分を提供する SvelteKit プロジェクトです。
Firebase や Supabase などのサービスと連携し、モダンなウェブアプリケーションを構築するためのベースとなるコードを含んでいます。

## Features

- **SvelteKit** をベースにした最新のフロントエンド開発環境
- Firebase を用いた認証機能
- Supabase を利用したデータベース連携
- Vercel をデプロイ先として利用（現状は手動デプロイ）
- ESLint と Prettier によるコードフォーマットと静的解析

## Prerequisites

- [Node.js](https://nodejs.org/) v20 以上
- npm、yarn、または pnpm
- Firebase / Supabase のアカウントとプロジェクト設定

## Getting Started

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-username/koi-tre-auth.git
cd koi-tre-auth
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.sample` をコピーして `.env` ファイルを作成し、内容を記述してください。

> **注意:** 各サービスのキーやドメインは、実際の値に置き換えてください。

### 4. 開発サーバーの起動

開発サーバーを起動して、ローカル環境で動作を確認します。

```bash
npm run dev
```

ブラウザで [http://localhost:5173](http://localhost:5173) を開いて、アプリケーションを確認してください。

## Code Quality

コードのフォーマットや静的解析には ESLint と Prettier を使用しています。
以下のコマンドでチェックを実行できます。

```bash
npm run lint
```

## Building for Production

本番用ビルドを作成するには、以下のコマンドを実行します。

```bash
npm run build
```

ビルド後、以下のコマンドでローカルプレビューが可能です。

```bash
npm run preview
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
