# 本番Stripe Webhookの接続

本番の購入受付が「準備中」の間に、Stripeから署名付き通知が届くことを確認する。Productionの `BILLING_ENABLED=false` とCheckout・契約管理の停止を維持する。

1. Koi-Tre本番Stripeのイベント配信先に `https://app.koi-tre.com/api/webhooks/stripe` を設定する。「このアカウント」のスナップショットイベントから `product.updated` を選ぶ。
2. 配信先の署名シークレットをVercelのProductionに `STRIPE_WEBHOOK_SECRET` として登録し、本番を再デプロイする。サンドボックスの署名シークレットとは分ける。
3. 商品の検証用メタデータを一時的に追加して戻す。Stripeの配信履歴で `product.updated` にHTTP 200が返ること、署名なしのPOSTは400になること、料金ページが「準備中」のままであることを確認する。
4. 決済用イベントの購読を設定する。Checkoutは `checkout.session.completed` と `checkout.session.async_payment_succeeded`、契約は `customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`、請求は `invoice.paid` と `invoice.payment_failed`、返金・紛争は `charge.refunded`、`charge.dispute.created`、`charge.dispute.closed`。

Productionでは `product.updated` を署名検証後に200で応答する。決済通知は503を返し、[Stripeの再送対象](https://docs.stripe.com/webhooks#automatic-retries)にする。決済・契約・利用枠への反映は販売開始時の別作業とする。検証には実決済を使わない。
