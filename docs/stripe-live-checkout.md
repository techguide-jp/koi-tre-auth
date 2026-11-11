# 本番StripeのCheckoutと契約管理

本番の `BILLING_ENABLED` は販売開始まで `false`。料金ページと新規購入APIは「準備中」となり、Webhookは自身の有効化設定で稼働する。

- 新規購入とCustomer Portalのセッション作成には `STRIPE_LIVE_BILLING_API_KEY` を使う。Koi-Tre本番Stripeの制限付きキーに、Checkoutセッションと顧客の作成、価格の読み取り、Customer Portalの設定の読み取りとセッション作成に必要な権限を付ける。Productionのサーバー環境に登録する。
- 販売の有効化には、本番用の8価格、Portal設定、Webhook署名と有効な反映設定が必要。テスト環境ではサンドボックス用のキー・価格・Portal設定を使う。
- 契約管理には本人のStripe顧客と、期間末解約が有効な専用Portal設定を使う。新規購入を一時停止しても、既存の契約者は設定済みのPortalで解約や支払い方法の変更ができる。[Stripe Customer Portalの公式手順](https://docs.stripe.com/customer-management/integrate-customer-portal)
- 購入画面から戻ったときは、本人の注文とStripe上の支払い状態を照合する。本番の照合にはWebhook用の読み取りキーを使う。Stripeの通知と照合が重なっても、契約・購入権・利用枠の反映は台帳で重複を防ぐ。
- 販売停止時は `BILLING_ENABLED=false` で再デプロイする。発行済みのCheckoutはStripe上の有効期限まで使えるため、即時に受付を止める必要がある場合はStripeで対象の未決済セッションを失効させる。[Checkoutセッションの失効](https://docs.stripe.com/api/checkout/sessions/expire)
