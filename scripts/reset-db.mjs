import postgres from 'postgres'
import { loadEnv } from './load-env.mjs'

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`
}

function quoteQualifiedName(schemaName, objectName) {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(objectName)}`
}

async function dropPublicObjects(sql) {
  const tables = await sql`
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename asc
  `
  const views = await sql`
    select viewname
    from pg_views
    where schemaname = 'public'
    order by viewname asc
  `
  const materializedViews = await sql`
    select matviewname
    from pg_matviews
    where schemaname = 'public'
    order by matviewname asc
  `
  const sequences = await sql`
    select sequence_name
    from information_schema.sequences
    where sequence_schema = 'public'
    order by sequence_name asc
  `

  for (const materializedView of materializedViews) {
    await sql.unsafe(
      `drop materialized view if exists ${quoteQualifiedName('public', materializedView.matviewname)} cascade`
    )
  }

  for (const view of views) {
    await sql.unsafe(`drop view if exists ${quoteQualifiedName('public', view.viewname)} cascade`)
  }

  for (const table of tables) {
    await sql.unsafe(`drop table if exists ${quoteQualifiedName('public', table.tablename)} cascade`)
  }

  for (const sequence of sequences) {
    await sql.unsafe(
      `drop sequence if exists ${quoteQualifiedName('public', sequence.sequence_name)} cascade`
    )
  }

  return {
    droppedTables: tables.length,
    droppedViews: views.length,
    droppedMaterializedViews: materializedViews.length,
    droppedSequences: sequences.length
  }
}

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  const { envFile } = loadEnv(nodeEnv)
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured')
  }

  const sql = postgres(databaseUrl, { prepare: false })

  try {
    const dropped = await dropPublicObjects(sql)
    await sql`drop schema if exists drizzle cascade`

    console.log('DB reset completed')
    console.log(`- Environment: ${nodeEnv}`)
    console.log(`- Env file: ${envFile}`)
    console.log(`- Dropped public tables: ${dropped.droppedTables}`)
    console.log(`- Dropped public views: ${dropped.droppedViews}`)
    console.log(`- Dropped public materialized views: ${dropped.droppedMaterializedViews}`)
    console.log(`- Dropped public sequences: ${dropped.droppedSequences}`)
    console.log('- Dropped drizzle schema: yes')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
