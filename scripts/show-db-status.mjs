import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { loadEnv } from './load-env.mjs'

function readLocalJournal() {
  const journalPath = path.resolve(process.cwd(), 'drizzle/meta/_journal.json')

  if (!fs.existsSync(journalPath)) {
    throw new Error(`Migration journal was not found at ${journalPath}`)
  }

  const raw = fs.readFileSync(journalPath, 'utf8')
  const journal = JSON.parse(raw)
  const entries = Array.isArray(journal.entries) ? journal.entries : []

  return entries.map((entry) => ({
    idx: Number(entry.idx),
    tag: String(entry.tag),
    when: Number(entry.when)
  }))
}

function formatDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl)

    if (url.password) {
      url.password = '****'
    }

    return url.toString()
  } catch {
    return '[invalid DATABASE_URL]'
  }
}

async function readAppliedMigrations(databaseUrl) {
  const sql = postgres(databaseUrl, { prepare: false })

  try {
    const tableExists = await sql`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'drizzle'
          and table_name = '__drizzle_migrations'
      ) as exists
    `

    if (!tableExists[0]?.exists) {
      return []
    }

    return await sql`
      select id, hash, created_at
      from drizzle.__drizzle_migrations
      order by created_at asc
    `
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function buildStatusOutput({
  nodeEnv,
  envFile,
  databaseUrl,
  localMigrations,
  appliedMigrations
}) {
  const appliedCreatedAt = new Set(
    appliedMigrations
      .map((migration) => Number(migration.created_at))
      .filter((value) => Number.isFinite(value))
  )
  const appliedCount = localMigrations.filter((migration) => appliedCreatedAt.has(migration.when)).length
  const pendingMigrations = localMigrations.filter((migration) => !appliedCreatedAt.has(migration.when))
  const latestAppliedCreatedAt = Math.max(
    0,
    ...appliedMigrations
      .map((migration) => Number(migration.created_at))
      .filter((value) => Number.isFinite(value))
  )
  const latestApplied = localMigrations.find((migration) => migration.when === latestAppliedCreatedAt) ?? null
  const lines = [
    'DB migration status',
    '',
    `- Environment: ${nodeEnv}`,
    `- Env file: ${envFile}`,
    `- Database URL: ${formatDatabaseUrl(databaseUrl)}`,
    `- Local migrations: ${localMigrations.length}`,
    `- Applied migrations: ${appliedCount}`,
    `- Pending migrations: ${pendingMigrations.length}`,
    latestApplied ? `- Latest applied: ${latestApplied.tag}` : '- Latest applied: なし',
    pendingMigrations.length === 0 ? '- Status: up to date' : '- Status: pending migrationsあり'
  ]

  if (pendingMigrations.length > 0) {
    lines.push('', 'Pending migration tags')
    for (const migration of pendingMigrations) {
      lines.push(`- ${migration.tag}`)
    }
  }

  if (appliedMigrations.length > appliedCount) {
    lines.push(
      '',
      `補足: DB 側に ${appliedMigrations.length - appliedCount} 件のローカル未対応 migration 記録があります`
    )
  }

  return lines.join('\n')
}

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  const { envFile } = loadEnv(nodeEnv)
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured')
  }

  const [localMigrations, appliedMigrations] = await Promise.all([
    Promise.resolve(readLocalJournal()),
    readAppliedMigrations(databaseUrl)
  ])

  console.log(
    buildStatusOutput({
      nodeEnv,
      envFile,
      databaseUrl,
      localMigrations,
      appliedMigrations
    })
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
