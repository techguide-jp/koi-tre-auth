import Stripe from 'stripe'
import { writeFile } from 'node:fs/promises'

const key = process.env.STRIPE_SECRET_KEY
if (!key?.startsWith('sk_test_')) throw Error('STRIPE_SECRET_KEY must be a test key')
const stripe = new Stripe(key, { timeout: 15_000, maxNetworkRetries: 1 })
const products = [
  ...['aoi', 'rin', 'shiori', 'yu', 'sota', 'ren'].map((id, index) => ({
    sku: `route:${id}`,
    variable: `STRIPE_PRICE_ROUTE_${id.toUpperCase()}`,
    name: `${['あおい', 'りん', 'しおり', 'ゆう', 'そうた', 'れん'][index]} 本編ルートパック`,
    amount: 1480,
    recurring: false
  })),
  {
    sku: 'topup',
    variable: 'STRIPE_PRICE_TOPUP',
    name: 'Koi-Tre 追加共通15枠',
    amount: 550,
    recurring: false
  },
  { sku: 'plus', variable: 'STRIPE_PRICE_PLUS', name: 'Koi-Tre Plus', amount: 980, recurring: true }
]
const config = {}
for (const item of products) {
  const lookupKey = `koi_tre_${item.sku.replace(':', '_')}_jpy_${item.amount}_v1`
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 2 })
  let price = prices.data[0]
  if (!price) {
    const product = await stripe.products.create(
      {
        name: item.name,
        metadata: { app: 'koi-tre', sku: item.sku, environment: 'test' }
      },
      { idempotencyKey: `${lookupKey}:product` }
    )
    price = await stripe.prices.create(
      {
        product: product.id,
        currency: 'jpy',
        unit_amount: item.amount,
        tax_behavior: 'inclusive',
        lookup_key: lookupKey,
        metadata: { app: 'koi-tre', sku: item.sku },
        ...(item.recurring ? { recurring: { interval: 'month' } } : {})
      },
      { idempotencyKey: `${lookupKey}:price` }
    )
  }
  if (
    price.livemode ||
    !price.active ||
    price.currency !== 'jpy' ||
    price.unit_amount !== item.amount ||
    (item.recurring &&
      (price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1))
  )
    throw Error('Unexpected existing test price')
  config[item.variable] = price.id
}
const configurations = await stripe.billingPortal.configurations.list({ limit: 100 })
let portal = configurations.data.find(
  (item) => item.metadata?.app === 'koi-tre' && item.metadata?.version === '1'
)
if (!portal)
  portal = await stripe.billingPortal.configurations.create(
    {
      business_profile: { headline: 'Koi-Tre テスト契約の管理' },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        subscription_cancel: { enabled: true, mode: 'at_period_end' }
      },
      metadata: { app: 'koi-tre', version: '1' }
    },
    { idempotencyKey: 'koi-tre:test:portal:v1' }
  )
config.STRIPE_PORTAL_CONFIGURATION_ID = portal.id
if (process.env.STRIPE_SETUP_OUTPUT)
  await writeFile(process.env.STRIPE_SETUP_OUTPUT, JSON.stringify(config, null, 2))
console.log(JSON.stringify({ testMode: true, priceCount: products.length, configuration: config }))
