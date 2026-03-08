import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  varchar
} from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
    firebaseUid: varchar('firebase_uid', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    displayName: varchar('display_name', { length: 255 }),
    photoUrl: varchar('photo_url', { length: 2048 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [unique('users_firebase_uid_key').on(table.firebaseUid)]
)

export const operations = pgTable(
  'operations',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid, {
        onDelete: 'restrict',
        onUpdate: 'cascade'
      }),
    conversationId: varchar('conversation_id', { length: 255 }).notNull(),
    llmText: text('llm_text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    query: text('query').notNull()
  },
  (table) => [index('operations_uid_created_at_idx').on(table.uid, table.createdAt)]
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Operation = typeof operations.$inferSelect
export type NewOperation = typeof operations.$inferInsert
