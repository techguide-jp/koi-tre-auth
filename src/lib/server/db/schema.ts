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
import type { Adventure, AdventureReward, Presentation, Rehearsal } from '$lib/adventure'
import type { StoryContext, StoryEnding } from '$lib/adventure'
import type { CharacterId } from '$lib/adventure-catalog'
import type { CreditKind } from '$lib/billing'
import type Stripe from 'stripe'
import type { PracticeEvaluation } from '$lib/adventure-progression'
import { boolean } from 'drizzle-orm/pg-core'
import type { KnowledgeContent, KnowledgePreview, KnowledgeTrace } from '$lib/knowledge-policy'
import type { CharacterContent, CharacterPreview, CharacterSnapshot } from '$lib/character-policy'
import type { GuestPracticeState } from '$lib/guest-practice'
import type { TipSelfRating } from '$lib/practice-tips'

export const guestSessions = pgTable('guest_sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
})
export const guestPractices = pgTable(
  'guest_practices',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    sessionId: varchar('session_id', { length: 64 })
      .notNull()
      .references(() => guestSessions.id, { onDelete: 'cascade' }),
    characterId: varchar('character_id', { length: 32 }).$type<CharacterId>().notNull(),
    characterContext: jsonb('character_context').$type<CharacterSnapshot>().notNull(),
    policyReleaseId: varchar('policy_release_id', { length: 36 }),
    storyContext: jsonb('story_context').$type<StoryContext>().notNull(),
    state: jsonb('state').$type<GuestPracticeState>().notNull(),
    attempts: integer('attempts').notNull().default(0),
    pendingToken: varchar('pending_token', { length: 36 }),
    claimedUid: varchar('claimed_uid', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    unique('guest_practices_session_character_key').on(table.sessionId, table.characterId)
  ]
)
export const guestRateLimits = pgTable('guest_rate_limits', {
  key: varchar('key', { length: 128 }).primaryKey(),
  used: integer('used').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
})

export const characterPolicyReleases = pgTable('character_policy_releases', {
  id: varchar('id', { length: 36 }).primaryKey(),
  characterId: varchar('character_id', { length: 32 }).$type<CharacterId>().notNull(),
  version: integer('version').generatedAlwaysAsIdentity().notNull().unique(),
  content: jsonb('content').$type<CharacterContent>().notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  note: varchar('note', { length: 200 }).notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
})
export const characterPolicySettings = pgTable('character_policy_settings', {
  characterId: varchar('character_id', { length: 32 }).$type<CharacterId>().primaryKey(),
  draft: jsonb('draft').$type<CharacterContent>().notNull(),
  draftRevision: integer('draft_revision').notNull().default(0),
  activeReleaseId: varchar('active_release_id', { length: 36 }).references(
    () => characterPolicyReleases.id
  ),
  preview: jsonb('preview').$type<CharacterPreview>(),
  updatedBy: varchar('updated_by', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
})

export const knowledgeReleases = pgTable('knowledge_releases', {
  id: varchar('id', { length: 36 }).primaryKey(),
  version: integer('version').generatedAlwaysAsIdentity().notNull().unique(),
  content: jsonb('content').$type<KnowledgeContent>().notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  note: varchar('note', { length: 200 }).notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
})
export const knowledgeSettings = pgTable('knowledge_settings', {
  id: varchar('id', { length: 16 }).primaryKey(),
  draft: jsonb('draft').$type<KnowledgeContent>().notNull(),
  draftRevision: integer('draft_revision').notNull().default(0),
  activeReleaseId: varchar('active_release_id', { length: 36 }).references(
    () => knowledgeReleases.id
  ),
  preview: jsonb('preview').$type<KnowledgePreview>(),
  updatedBy: varchar('updated_by', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
})

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
    adventure: jsonb('adventure').$type<Adventure>(),
    reward: jsonb('reward').$type<AdventureReward>(),
    favoriteTurn: integer('favorite_turn'),
    rehearsal: jsonb('rehearsal').$type<Rehearsal>(),
    creditCost: integer('credit_cost').notNull().default(1),
    storyContext: jsonb('story_context').$type<StoryContext>(),
    characterContext: jsonb('character_context').$type<CharacterSnapshot>(),
    storyEnding: jsonb('story_ending').$type<StoryEnding>(),
    policyReleaseId: varchar('policy_release_id', { length: 36 }).references(
      () => knowledgeReleases.id
    ),
    chargedAt: timestamp('charged_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    tipId: varchar('tip_id', { length: 16 }),
    tipShownAt: timestamp('tip_shown_at', { withTimezone: true, mode: 'date' }),
    pendingRequestId: varchar('pending_request_id', { length: 36 }),
    pendingText: text('pending_text'),
    pendingToken: varchar('pending_token', { length: 36 }),
    pendingUntil: timestamp('pending_until', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [index('practices_uid_charged_at_idx').on(table.uid, table.chargedAt)]
)

export const practiceTipRatings = pgTable(
  'practice_tip_ratings',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tipId: varchar('tip_id', { length: 16 }).notNull(),
    value: varchar('value', { length: 16 }).$type<TipSelfRating>().notNull(),
    ratedAt: timestamp('rated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    index('practice_tip_ratings_uid_tip_date_idx').on(table.uid, table.tipId, table.ratedAt)
  ]
)

export const billingCustomers = pgTable('billing_customers', {
  uid: varchar('uid', { length: 255 })
    .primaryKey()
    .references(() => users.firebaseUid),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
})
export const billingCheckouts = pgTable(
  'billing_checkouts',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid),
    product: varchar('product', { length: 40 }).notNull(),
    stripeSessionId: varchar('stripe_session_id', { length: 255 }).unique(),
    url: text('url'),
    requestParams: jsonb('request_params').$type<Stripe.Checkout.SessionCreateParams>(),
    status: varchar('status', { length: 32 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [index('billing_checkouts_uid_product_idx').on(table.uid, table.product)]
)
export const routePurchases = pgTable(
  'route_purchases',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid),
    characterId: varchar('character_id', { length: 32 }).$type<CharacterId>().notNull(),
    paymentIntentId: varchar('payment_intent_id', { length: 255 }).unique(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (table) => [index('route_purchases_uid_character_idx').on(table.uid, table.characterId)]
)
export const billingSubscriptions = pgTable(
  'billing_subscriptions',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid),
    status: varchar('status', { length: 32 }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true, mode: 'date' }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [index('billing_subscriptions_uid_idx').on(table.uid)]
)
export const creditGrants = pgTable(
  'credit_grants',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid),
    kind: varchar('kind', { length: 16 }).$type<CreditKind>().notNull(),
    characterId: varchar('character_id', { length: 32 }).$type<CharacterId>(),
    units: integer('units').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' })
  },
  (table) => [index('credit_grants_uid_idx').on(table.uid)]
)
export const creditSpends = pgTable(
  'credit_spends',
  {
    id: varchar('id', { length: 320 }).primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid),
    practiceId: varchar('practice_id', { length: 36 })
      .notNull()
      .references(() => practices.id),
    grantId: varchar('grant_id', { length: 255 })
      .notNull()
      .references(() => creditGrants.id),
    units: integer('units').notNull(),
    state: varchar('state', { length: 16 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' })
  },
  (table) => [
    index('credit_spends_uid_idx').on(table.uid),
    unique('credit_spends_practice_grant_key').on(table.practiceId, table.grantId)
  ]
)
export const billingEvents = pgTable('billing_events', {
  id: varchar('id', { length: 255 }).primaryKey(),
  type: varchar('type', { length: 100 }).notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
})
export const billingPaymentStates = pgTable('billing_payment_states', {
  paymentIntentId: varchar('payment_intent_id', { length: 255 }).primaryKey(),
  uid: varchar('uid', { length: 255 })
    .notNull()
    .references(() => users.firebaseUid),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
})
export const characterEndings = pgTable(
  'character_endings',
  {
    id: varchar('id', { length: 300 }).primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid),
    characterId: varchar('character_id', { length: 32 }).$type<CharacterId>().notNull(),
    practiceId: varchar('practice_id', { length: 36 })
      .notNull()
      .references(() => practices.id),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [unique('character_endings_uid_character_key').on(table.uid, table.characterId)]
)

export const characterRelationships = pgTable(
  'character_relationships',
  {
    id: varchar('id', { length: 320 }).primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid),
    characterId: varchar('character_id', { length: 32 }).$type<CharacterId>().notNull(),
    version: integer('version').notNull(),
    earned: integer('earned').notNull().default(0),
    strain: integer('strain').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [unique('character_relationships_uid_character_key').on(table.uid, table.characterId)]
)

export const episodeAchievements = pgTable(
  'episode_achievements',
  {
    id: varchar('id', { length: 380 }).primaryKey(),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid),
    characterId: varchar('character_id', { length: 32 }).$type<CharacterId>().notNull(),
    episodeId: varchar('episode_id', { length: 64 }).notNull(),
    version: integer('version').notNull(),
    bestScore: integer('best_score_tenths'),
    bestPassingScore: integer('best_passing_score_tenths'),
    contribution: integer('contribution').notNull().default(0),
    clearedAt: timestamp('cleared_at', { withTimezone: true, mode: 'date' })
  },
  (table) => [
    unique('episode_achievements_uid_character_episode_key').on(
      table.uid,
      table.characterId,
      table.episodeId
    )
  ]
)

export const practiceEvaluations = pgTable(
  'practice_evaluations',
  {
    practiceId: varchar('practice_id', { length: 36 })
      .primaryKey()
      .references(() => practices.id),
    uid: varchar('uid', { length: 255 })
      .notNull()
      .references(() => users.firebaseUid),
    characterId: varchar('character_id', { length: 32 }).$type<CharacterId>().notNull(),
    version: integer('version').notNull(),
    result: jsonb('result').$type<PracticeEvaluation>().notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true, mode: 'date' }),
    pendingToken: varchar('pending_token', { length: 36 }),
    pendingUntil: timestamp('pending_until', { withTimezone: true, mode: 'date' }),
    retryAfter: timestamp('retry_after', { withTimezone: true, mode: 'date' })
  },
  (table) => [index('practice_evaluations_uid_idx').on(table.uid)]
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
    presentation: jsonb('presentation').$type<Presentation>(),
    policyContext: jsonb('policy_context').$type<KnowledgeTrace>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    unique('practice_turns_request_key').on(table.practiceId, table.requestId),
    unique('practice_turns_position_key').on(table.practiceId, table.position)
  ]
)
