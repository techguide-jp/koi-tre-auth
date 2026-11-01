import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar
} from 'drizzle-orm/pg-core'
import type { CustomSceneInput, PracticeFeedback, SceneId } from '$lib/practice'

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

export const practices = pgTable(
  'practices',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid, { onDelete: 'restrict', onUpdate: 'cascade' }),
    sceneId: varchar('scene_id', { length: 32 }).$type<SceneId>().notNull(),
    customScene: jsonb('custom_scene').$type<CustomSceneInput>(),
    chargedAt: timestamp('charged_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    pendingRequestId: varchar('pending_request_id', { length: 36 }),
    pendingText: text('pending_text'),
    pendingToken: varchar('pending_token', { length: 36 }),
    pendingUntil: timestamp('pending_until', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [index('practices_uid_charged_at_idx').on(table.uid, table.chargedAt)]
)

export const practiceTurns = pgTable(
  'practice_turns',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    practiceId: varchar('practice_id', { length: 36 })
      .notNull()
      .references(() => practices.id, { onDelete: 'restrict' }),
    requestId: varchar('request_id', { length: 36 }).notNull(),
    position: integer('position').notNull(),
    userText: text('user_text').notNull(),
    assistantText: text('assistant_text').notNull(),
    feedback: jsonb('feedback').$type<PracticeFeedback>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    unique('practice_turns_request_key').on(table.practiceId, table.requestId),
    unique('practice_turns_position_key').on(table.practiceId, table.position)
  ]
)
