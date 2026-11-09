# 初回練習の仕様と公開手順

> 2026-11-09整理：以下は3往復の練習を初回公開した時点の設計・検証記録。現行の3/6往復、1/2枠消費、25点評価、本編と好感度は[文書一覧](README.md)から参照する。ここに記載されたテスト件数・環境・Difyの状態は各検証時点のもの。

> この文書は初回公開時の仕様・検証記録です。振り返りの拡充、定型文上書きの廃止、Jev補助評価、生成モデルの変更については [会話分析の仕様](conversation-analysis.md) を参照してください。

## 利用者の流れ

トップの会話例 → 3つの場面から選択 → 操作によるGoogleログイン → 3回返答 → 振り返り。名前・性別・年齢・アクセスキーの入力は不要。

月10回の練習。最初の返答と履歴をDBへ正常保存した時点で1回を消費する。途中終了しても同じ練習の残り2回・振り返り・翌月の再開には追加消費しない。新しい練習の最初の保存成功日時を基準に、日本時間の月で集計する。旧operations履歴は保持し、新しい練習枠には換算しない。

## 境界と再送

- APIは全てFirebase IDトークンで本人確認し、UIDをリクエスト本文から受け取らない。GETにも所有権チェックとno-storeを適用する。
- `POST /api/me/practices` はクライアント生成UUIDとsceneIdから練習を作る。同じUUIDの再送は同じ練習を返す。
- `GET /api/me/practices` は月枠・生成中の予約数・途中/最新練習IDを返す。`GET /api/me/practices/[id]` は保存済み会話と処理中の入力を返す。
- `POST /api/me/practices/[id]/messages` はrequestId、text（1〜1000文字）、expectedTurn（0〜2）と任意の計測コンテキストを受け取る。同じrequestIdは同じ本文に限り再利用できる。
- ユーザー行のロック下で月枠と生成中予約を確認する。外部API待機中はDBトランザクションを保持しない。予約は75秒、Dify呼び出しは55秒でタイムアウトする。
- 成功時は発言・operation・回数・完了状態を同一トランザクションで保存する。古い予約トークンの処理は保存できない。失敗時は本文を残し予約を解放する。サーバー処理が強制終了した場合は予約期限後に再試行できる。
- ブラウザはタブ内sessionStorageへ下書きとrequestIdを保存する。生成中に再読み込みしても、保存された状態を取得して再開する。
- GA4は保存成功ごとにquestion_submitted、3回目の保存成功時だけpractice_completedを送る。リプレイでは送信しない。送信は既存と同じベストエフォートで、計測失敗による生成再試行は行わない。

## Dify

`dify/koi-tre-practice.yml` を別のWorkflowアプリにインポートする。更新済みOpenAI認証で利用可能なgpt-4.1を利用する。入力はscene、transcript、turn、total_turns。出力resultはJSON文字列で、replyと、最終回だけstrength / improvement / quote / rewriteを持つfeedbackを返す。

引用quoteが実際の利用者の発言に含まれるか、アプリ側でも検証する。実生成でAIが未発言の好みを補う出力があったため、表示する改善点と言い換えは本人の原文と場面別の定型句から組み立てる。既に質問している場合は質問を追加せず、答えやすくするひと言を添える。よかった点と会話相手の返答はDifyの生成を利用する。Workflowにはユーザー確認・保存・回数消費のHTTPコールバックを設けない。Difyのuserは練習UUIDで、Googleプロフィールは渡さない。APIキーはサーバー専用のDIFY_PRACTICE_API_KEYに保存する。

## 公開と切り戻し

1. migrationの追加テーブルと制約を確認し、検証DBへ適用。再度db:generateで差分なしを確認する。
2. Dify専用Workflowをサンプル会話で検証し、公開する。APIキーをVercel Productionへ秘密値として登録する。実生成を含む全体検証はローカルの独立DBで行い、Vercel Previewから本番DBへテストデータを書き込まない。
3. 既存データを維持して本番へ追加migrationを適用する。DIFY_API_BASE_URLは通常https://api.dify.ai/v1。PRACTICE_ENABLEDは準備完了までfalse。
4. 新しい画面を有効にしたローカル環境で認証・生成・保存・再開を確認する。Vercelはproductionターゲットに --skip-domain でデプロイして、ドメイン切り替え前に表示・認証必須を確認する。確認後にpromoteする。
5. 新画面ではアクセスキーの新規発行が410になる。旧コールバックは発行済みキーの12時間の有効期間を考慮して残す。practice:で始まる会話IDは旧保存APIで拒否する。
6. 切り戻しはPRACTICE_ENABLED=falseとして再デプロイする。旧画面・キー発行が復帰し、既存の新練習データは保持される。新練習のGETは維持し、送信は503で停止する。旧発言枠と新練習枠は別集計。

## ローカル検証

本番の認証に偽ユーザーを作らず検証できるよう、Firebase Auth Emulatorを利用できる。VITE_PROJECT_ID / FIREBASE_PROJECT_IDはdemo-で始まる同じ値、VITE_FIREBASE_AUTH_EMULATOR_URLはhttp://127.0.0.1:9099、FIREBASE_AUTH_EMULATOR_HOSTは127.0.0.1:9099とする。サーバーは本番モードやdemo-以外でのエミュレーター設定を拒否し、ブラウザも開発モードのdemo-プロジェクトに限定して接続する。

pnpm check、pnpm lint、pnpm test、pnpm buildを実行する。実際の外部Dify生成と、テスト用応答による画面・保存検証は結果を区別して記録する。

## 2026-11-01の検証記録

- 型チェック・lint・33テスト・Vercel向けビルドを通過。
- 一時的なPostgreSQL 17に追加migrationを適用し、再生成で差分なしを確認。
- Firebase Auth Emulatorと一時DB、テスト用AI応答を使い、スマートフォン幅で場面選択、ログイン取消・再試行、下書きの再読み込み、送信中の再読み込み、3回返答と振り返りを確認。
- 画面からの3回返答は、DB上で練習1回・発言3回・operation3件となり、トップの残り枠は9回だった。本番Auth・DB・GA4にテスト利用は追加していない。
- Difyに別アプリ「Koi-Tre Practice v1」（39e61eb7-7497-46f1-a7d0-5ee841e11373）を作成した。OpenAI認証はユーザーによる再更新後に成功。miniモデルでは未発言の好みを補う出力があり、gpt-4.1と事実を限定する指示に変更した。専用APIを公開し、WebアプリとMCPは無効にした。承認後に作成した専用キーをVercel ProductionのDIFY_PRACTICE_API_KEYへ秘密値として保存した。本番切り替えは完了（最終結果は下記）。

- 本番Neonプロジェクト内への検証DB新設は自動承認レビューで拒否され、実行されていない。検証はローカルの独立DBで行い、Vercelでのドメイン切替前の確認は本番データへの書き込みを伴わない手順に変更した。

- 最終のパーサーで実Difyの3場面・各3返答を検証し、全て成功した。本人の原文を引用し、未発言の好みを加えない言い換えになっていることを確認した。
- 本番への追加migration適用前後で既存usersは10件、operationsは24件のまま。新しいpracticesとpractice_turnsはそれぞれ0件で、旧データを変更していない。

- ローカル画面から実Difyへ3回返答して完了し、振り返りを保存した。テスト応答での先行確認と合計で、ローカルDBは消費2練習・完了2練習・6発言・6operationsだった。最終回は新しい質問を表示せず、振り返りへ案内する。

## 404処理の互換性

SvelteKit 2.17とadapter-vercel 5.10.3では、ルートごとの実行時間設定で関数を分割すると、空のcatchall manifestにroot layout/errorが含まれず、存在しないURLが500になる。ルート個別のmaxDurationを外し、アダプターの既定を65秒に統一した。`pnpm build` は `scripts/check-vercel-output.mjs` も実行し、404画面の部品が含まれることを検証する。実行時間設定を個別に戻す際は、単にビルドが成功するだけでなく、デプロイ先の404応答も確認する。

## 本番反映結果

- 最終の実装コードは `f8aa37c`。Vercelの本番デプロイは `dpl_CHs1SfWnNfPEhqSeWi2R5qU8j842`（koi-tre-auth-kozqjupdz-tashua314s-projects.vercel.app）。`app.koi-tre.com` が同じデプロイを指すことをAPIで確認した。
- ドメイン切替前後で、トップ200、未認証の練習API401、存在しないURLとfavicon.icoの404を確認した。修正版のログには確認用404が4件あり、5xxは0件だった。
- 公開サイトの場面選択からログイン画面へ場面を引き継ぎ、Googleログインが操作を待つことを確認した。ブラウザの場面選択ボタンも有効だった。
- 本番DBに合成の質問・練習は作っていない。反映直後の確認時点ではusers10件・operations24件を保持し、practicesとpractice_turnsは0件。実生成と認証・保存の全体検証はローカルの独立DBとAuth Emulatorで行った。
- 検証用のローカルサーバー、Auth Emulator、PostgreSQLを停止し、キー転送ファイルと一時DB接続情報を削除した。APIキーはGitやチャットに記載していない。

旧画面への表示切り戻しと新APIの送信停止はテスト済み。旧Dify Chatflow自体は変更・再実行していない。旧ドラフトにはSupabaseを照会するノードが残っていたため、旧Difyへ運用を戻す場合は、その認証照会とモデル設定を改めて確認する。
