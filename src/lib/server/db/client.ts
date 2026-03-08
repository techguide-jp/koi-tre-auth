import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    prepare: false
  })

  return {
    client,
    db: drizzle(client, {
      schema
    })
  }
}

export type Database = ReturnType<typeof createDb>['db']

let database: ReturnType<typeof createDb> | null = null

export function getDb(): Database {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured')
  }

  if (!database) {
    database = createDb(process.env.DATABASE_URL)
  }

  return database.db
}

export async function closeDbConnection() {
  if (!database) {
    return
  }

  await database.client.end({ timeout: 5 })
  database = null
}
