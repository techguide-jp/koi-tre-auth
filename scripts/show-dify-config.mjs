import 'dotenv/config'

function parseArgs(argv) {
  const options = {
    showSecrets: false
  }

  for (const arg of argv) {
    if (arg === '--') {
      continue
    }

    if (arg === '--show-secrets') {
      options.showSecrets = true
      continue
    }

    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length)
      continue
    }

    throw new Error(`Unsupported option: ${arg}`)
  }

  return options
}

function normalizeBaseUrl(input) {
  const value = input?.trim()

  if (!value) {
    return 'https://www.koi-tre.com'
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/+$/, '')
  }

  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value)) {
    return `http://${value}`
  }

  return `https://${value.replace(/\/+$/, '')}`
}

function formatBearerToken(token, showSecrets) {
  const trimmed = token?.trim()

  if (!trimmed) {
    return '[未設定: DIFY_API_BEARER_TOKEN]'
  }

  if (showSecrets) {
    return trimmed
  }

  if (trimmed.length <= 8) {
    return '*'.repeat(trimmed.length)
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
}

function buildOutput(options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.VITE_APP_DOMAIN)
  const bearerToken = formatBearerToken(process.env.DIFY_API_BEARER_TOKEN, options.showSecrets)
  const verifyUrl = `${baseUrl}/api/dify/users/exists`
  const saveUrl = `${baseUrl}/api/dify/operations`
  const lines = [
    'Dify 設定項目',
    '',
    '開始フォーム',
    '- ラベル: あなたのアクセスキー（画面下部に記載）',
    '- 変数名: access_key',
    '- 種別: text-input',
    '- 必須: true',
    '',
    'HTTP リクエスト: アクセスキーを検証',
    '- Method: GET',
    `- URL: ${verifyUrl}`,
    '- Authorization Type: bearer',
    `- Authorization Token: ${bearerToken}`,
    '- Query Params: accessKey={{#start.access_key#}}',
    '',
    'HTTP リクエスト: 履歴保存',
    '- Method: POST',
    `- URL: ${saveUrl}`,
    '- Authorization Type: bearer',
    `- Authorization Token: ${bearerToken}`,
    '- Headers: Content-Type: application/json',
    '- Body(JSON):',
    '{',
    '  "accessKey": "{{#start.access_key#}}",',
    '  "conversationId": "{{#sys.conversation_id#}}",',
    '  "llmText": "{{#1715761161876.result#}}",',
    '  "query": "{{#1715761161876.query#}}"',
    '}',
    '',
    '補足',
    '- Bearer トークンを実値で表示する場合: pnpm dify:config -- --show-secrets',
    `- URL を差し替える場合: pnpm dify:config -- --base-url=${baseUrl}`
  ]

  return lines.join('\n')
}

try {
  const options = parseArgs(process.argv.slice(2))
  console.log(buildOutput(options))
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(message)
  process.exitCode = 1
}
