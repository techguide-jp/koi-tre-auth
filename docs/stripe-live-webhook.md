# 本番Stripe Webhookの接続

本番の購入受付が「準備中」の間に、Stripeから署名付き通知が届くことを確認する。Productionの `BILLING_ENABLED=false` とCheckout・契約管理の停止を維持する。

1. Koi-Tre本番Stripeのイベント配信先に `https://app.koi-tre.com/api/webhooks/stripe` を設定する。「このアカウント」のスナップショットイベントから `product.updated` を選ぶ。
2. 配信先の署名シークレットをVercelのProductionに `STRIPE_WEBHOOK_SECRET` として登録し、本番を再デプロイする。サンドボックスの署名シークレットとは分ける。
3. 商品の検証用メタデータを一時的に追加して戻す。Stripeの配信履歴で `product.updated` にHTTP 200が返ること、署名なしのPOSTは400になること、料金ページが「準備中」のままであることを確認する。
4. 決済用イベントの購読を設定する。Checkoutは `checkout.session.completed` と `checkout.session.async_payment_succeeded`、契約は `customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`、請求は `invoice.paid` と `invoice.payment_failed`、返金・紛争は `charge.refunded`、`charge.dispute.created`、`charge.dispute.closed`。

## 契約・購入権・利用枠への反映

本番では `BILLING_ENABLED=false` のまま、次の設定でWebhookの反映を有効にできる。

1. Koi-Tre本番アカウントの制限付きキーを作成する。決済通知の処理に使うCheckoutセッション、契約、請求書とその支払い、Charge、紛争を読み取れるようにする。VercelのProductionに `STRIPE_LIVE_WEBHOOK_API_KEY` として登録する。
2. 本番8価格の `STRIPE_PRICE_*` と配信先の `STRIPE_WEBHOOK_SECRET` を照合する。反映を開始する時点で `STRIPE_LIVE_WEBHOOK_ENABLED=true` をProductionに設定し、対応版を再デプロイする。
3. Stripeの配信結果とKoi-Treの契約・購入権・利用枠を照合する。既存の処理済みイベントと利用枠台帳で再送を重複反映から守る。

設定前は決済通知に503を返す。署名検証済みの `product.updated` は接続確認用に200で応答する。反映開始後に失敗した通知はStripeの配信履歴で確認し、原因を修正して再送する。本番の自動再送期間は最大3日間。障害時に反映を止めるには `STRIPE_LIVE_WEBHOOK_ENABLED=false` にして再デプロイする。[Stripeの再送仕様](https://docs.stripe.com/webhooks#automatic-retries)
