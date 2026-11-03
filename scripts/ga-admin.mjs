import { v1beta, v1alpha } from '@google-analytics/admin'
import { loadedEnv } from './load-env.mjs'

const command = process.argv[2] ?? 'list'
const dryRun = process.argv.includes('--dry-run')
const propertyId = process.env.GA4_PROPERTY_ID
const measurementId = process.env.GA4_MEASUREMENT_ID ?? process.env.VITE_MEASUREMENT_ID
const options = { fallback: true }

// GA4 の権限を持つ ADC を明示した場合のみ、Firebase 用認証から切り替える。
if (process.env.GA4_USE_ADC !== 'true' && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    options.credentials = {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }
  }
}
if (process.env.GA4_QUOTA_PROJECT_ID) options.quotaProjectId = process.env.GA4_QUOTA_PROJECT_ID

const client = new v1beta.AnalyticsAdminServiceClient(options)
const alpha = new v1alpha.AnalyticsAdminServiceClient(options)
const callOptions = { timeout: 15000 }

async function main() {
  if (!['list', 'sync'].includes(command)) throw new Error('list または sync を指定してください。')
  if (!propertyId) {
    if (command !== 'list') throw new Error('GA4_PROPERTY_ID を設定してください。')
    const [accounts] = await client.listAccountSummaries({}, callOptions)
    console.log(
      JSON.stringify(
        accounts.map((account) => ({
          account: account.account,
          properties: account.propertySummaries?.map((property) => ({
            property: property.property,
            displayName: property.displayName
          }))
        })),
        null,
        2
      )
    )
    return
  }
  if (!/^\d+$/.test(propertyId)) throw new Error('GA4_PROPERTY_ID は数値 ID を指定してください。')
  const parent = `properties/${propertyId}`
  const [streams] = await client.listDataStreams({ parent }, callOptions)
  const stream = streams.find((item) => item.webStreamData?.measurementId === measurementId)
  if (!stream?.name)
    throw new Error('計測 ID に一致する Web ストリームがありません。設定を確認してください。')
  const [keyEvents] = await client.listKeyEvents({ parent }, callOptions)
  const name = `${stream.name}/enhancedMeasurementSettings`
  const [enhanced] = await alpha.getEnhancedMeasurementSettings({ name }, callOptions)

  console.log(
    JSON.stringify(
      {
        envFile: loadedEnv.envFile,
        property: parent,
        stream: stream.name,
        measurementId,
        keyEvents: keyEvents.map((event) => event.eventName),
        historyPageViewsEnabled: enhanced.pageChangesEnabled,
        serverApiSecretConfigured: Boolean(process.env.GA4_API_SECRET),
        dryRun
      },
      null,
      2
    )
  )

  if (command !== 'sync') return
  if (!keyEvents.some((event) => event.eventName === 'question_submitted')) {
    console.log(
      `${dryRun ? '予定' : '作成'}: question_submitted キーイベント（イベントごとに 1 回）`
    )
    if (!dryRun) {
      await client.createKeyEvent(
        {
          parent,
          keyEvent: { eventName: 'question_submitted', countingMethod: 'ONCE_PER_EVENT' }
        },
        callOptions
      )
    }
  }
  if (enhanced.pageChangesEnabled) {
    console.log(`${dryRun ? '予定' : '更新'}: 履歴変更による自動ページビューを停止`)
    if (!dryRun) {
      await alpha.updateEnhancedMeasurementSettings(
        {
          enhancedMeasurementSettings: { name, pageChangesEnabled: false },
          updateMask: { paths: ['page_changes_enabled'] }
        },
        callOptions
      )
    }
  }
}

main()
  .catch((error) => {
    // SDK の例外全体には認証情報やリクエストが含まれ得るため、出力を限定する。
    console.error(`GA4 設定を確認できませんでした（${error.code ?? 'configuration'}）。`)
    if (!error.code) console.error(error.message)
    console.error(
      'GA4_PROPERTY_ID・計測 ID・Analytics Admin API の有効状態・GA4 編集権限を確認してください。'
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await Promise.all([client.close(), alpha.close()])
  })
