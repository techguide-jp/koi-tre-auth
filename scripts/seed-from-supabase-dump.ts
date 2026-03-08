import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { count, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { operations, users } from '../src/lib/server/db/schema.ts'

const DUMP_FILE = 'db_cluster-13-07-2025@01-16-45.neon-ready-no-connect.sql'
const EXPECTED_USER_COUNT = 10
const EXPECTED_OPERATION_COUNT = 24

type CopyRecord = Record<string, string | null>

function extractCopyBlock(contents: string, tableName: 'users' | 'operations') {
  const matcher = new RegExp(
    `COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;\\n([\\s\\S]*?)\\n\\\\\\.`,
    'm'
  )
  const match = contents.match(matcher)

  if (!match) {
    throw new Error(`COPY block for public.${tableName} was not found in ${DUMP_FILE}`)
  }

  const columns = match[1].split(',').map((column) => column.trim())
  const rows = match[2]
    .split('\n')
    .map((row) => row.trimEnd())
    .filter(Boolean)

  return { columns, rows }
}

function decodeCopyValue(value: string) {
  if (value === '\\N') {
    return null
  }

  return value.replace(/\\(.)/g, (_, escaped: string) => {
    switch (escaped) {
      case 'n':
        return '\n'
      case 'r':
        return '\r'
      case 't':
        return '\t'
      case 'b':
        return '\b'
      case 'f':
        return '\f'
      case 'v':
        return '\v'
      case '\\':
        return '\\'
      default:
        return escaped
    }
  })
}

function parseCopyRows(contents: string, tableName: 'users' | 'operations') {
  const { columns, rows } = extractCopyBlock(contents, tableName)

  return rows.map((row) => {
    const values = row.split('\t')
    if (values.length !== columns.length) {
      throw new Error(
        `Unexpected column count for public.${tableName}: expected ${columns.length}, received ${values.length}`
      )
    }

    return columns.reduce<CopyRecord>((record, column, index) => {
      record[column] = decodeCopyValue(values[index] ?? '')
      return record
    }, {})
  })
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured')
  }

  const dumpPath = path.resolve(process.cwd(), DUMP_FILE)
  const dumpContents = await readFile(dumpPath, 'utf8')
  const userRows = parseCopyRows(dumpContents, 'users').map((row) => ({
    id: Number(row.id),
    firebaseUid: row.firebase_uid as string,
    email: row.email,
    displayName: row.display_name,
    photoUrl: row.photo_url,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
  }))
  const operationRows = parseCopyRows(dumpContents, 'operations').map((row) => ({
    id: Number(row.id),
    uid: row.uid as string,
    conversationId: row.conversation_id as string,
    llmText: row.llm_text as string,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    query: row.query as string
  }))

  const client = postgres(databaseUrl, { prepare: false })
  const db = drizzle(client)

  try {
    await db.transaction(async (tx) => {
      await tx.delete(operations)
      await tx.delete(users)
      await tx.insert(users).values(userRows)
      await tx.insert(operations).values(operationRows)
      await tx.execute(
        sql.raw(
          "select setval(pg_get_serial_sequence('users', 'id'), coalesce((select max(id) from users), 1), true)"
        )
      )
      await tx.execute(
        sql.raw(
          "select setval(pg_get_serial_sequence('operations', 'id'), coalesce((select max(id) from operations), 1), true)"
        )
      )
    })

    const [userCount] = await db.select({ count: count() }).from(users)
    const [operationCount] = await db.select({ count: count() }).from(operations)
    const insertedUsers = Number(userCount?.count ?? 0)
    const insertedOperations = Number(operationCount?.count ?? 0)

    if (insertedUsers !== EXPECTED_USER_COUNT || insertedOperations !== EXPECTED_OPERATION_COUNT) {
      throw new Error(
        `Unexpected seeded row counts: users=${insertedUsers}, operations=${insertedOperations}`
      )
    }

    console.log(
      `Seeded public.users=${insertedUsers} and public.operations=${insertedOperations} from ${DUMP_FILE}`
    )
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
