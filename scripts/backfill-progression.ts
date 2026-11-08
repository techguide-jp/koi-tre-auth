import { eq, sql } from 'drizzle-orm'
import { closeDbConnection, getDb } from '../src/lib/server/db/client'
import { users } from '../src/lib/server/db/schema'
import { readProgression, settleProgression } from '../src/lib/server/db/repositories/progression'

// DATABASE_URLは呼び出し元が明示する。ローカルの.envで本番接続先を上書きしない。
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URLを指定してください。')
const apply = process.argv.includes('--apply')
try {
  const db = getDb()
  const owners = await db.select({ uid: users.firebaseUid }).from(users)
  const counts = { users: owners.length, cleared: 0, evaluated: 0, pending: 0 }
  if (apply) {
    for (const owner of owners) {
      await db.transaction(async (tx) => {
        await tx.select().from(users).where(eq(users.firebaseUid, owner.uid)).for('update')
        await settleProgression(tx, owner.uid)
      })
    }
  }
  for (const owner of owners) {
    const view = await readProgression(db, owner.uid)
    counts.cleared += view.clearedEpisodes.length
  }
  const [evaluations] = await db.execute<{ evaluated: number; pending: number }>(sql`
    select count(*) filter (where settled_at is not null)::int as evaluated,
           count(*) filter (where settled_at is null)::int as pending
    from practice_evaluations`)
  counts.evaluated = evaluations.evaluated
  counts.pending = evaluations.pending
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'read-only', version: 1, ...counts }))
} finally {
  await closeDbConnection()
}
