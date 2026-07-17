import { pgTable, serial, timestamp, uuid, varchar, integer, text, jsonb, boolean, check, numeric, foreignKey, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const promptTemplate = pgTable("prompt_template", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	type: varchar({ length: 20 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	version: integer().default(1),
	systemPrompt: text("system_prompt").notNull(),
	modules: jsonb(),
	variables: jsonb(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const buyerPersona = pgTable("buyer_persona", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	personalityTraits: jsonb("personality_traits"),
	language: varchar({ length: 10 }).default('es'),
	openingMessage: text("opening_message"),
	behaviorRules: jsonb("behavior_rules"),
	difficulty: integer().default(3),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	check("buyer_persona_difficulty_check", sql`(difficulty >= 1) AND (difficulty <= 5)`),
]);

export const marketConfig = pgTable("market_config", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	countryCode: varchar("country_code", { length: 5 }).notNull(),
	countryName: varchar("country_name", { length: 100 }),
	language: varchar({ length: 10 }).notNull(),
	currency: varchar({ length: 5 }).default('EUR'),
	avgPriceRatio: numeric("avg_price_ratio", { precision: 3, scale:  2 }).default('1.00'),
	meetupPreference: varchar("meetup_preference", { length: 20 }).default('avoid'),
	shippingSupported: boolean("shipping_supported").default(true),
	codSupported: boolean("cod_supported").default(true),
	notes: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const scenarioConfig = pgTable("scenario_config", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	buyerPersonaId: uuid("buyer_persona_id"),
	marketConfigId: uuid("market_config_id"),
	productType: varchar("product_type", { length: 100 }),
	productCondition: varchar("product_condition", { length: 50 }),
	listedPrice: numeric("listed_price", { precision: 10, scale:  2 }),
	sopChecklist: jsonb("sop_checklist"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.buyerPersonaId],
			foreignColumns: [buyerPersona.id],
			name: "scenario_config_buyer_persona_id_fkey"
		}),
	foreignKey({
			columns: [table.marketConfigId],
			foreignColumns: [marketConfig.id],
			name: "scenario_config_market_config_id_fkey"
		}),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	companyId: uuid("company_id"),
	name: varchar({ length: 100 }).notNull(),
	email: varchar({ length: 255 }),
	role: varchar({ length: 20 }).default('employee').notNull(),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const trainingHistory = pgTable("training_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	companyId: uuid("company_id"),
	userId: uuid("user_id"),
	scenarioId: uuid("scenario_id"),
	caseId: uuid("case_id"),
	mode: varchar({ length: 30 }).notNull(),
	status: varchar({ length: 20 }).default('active'),
	buyerPersonaId: uuid("buyer_persona_id"),
	totalMessages: integer("total_messages").default(0),
	durationSeconds: integer("duration_seconds").default(0),
	finalScore: numeric("final_score", { precision: 5, scale:  2 }),
	ruleScore: numeric("rule_score", { precision: 5, scale:  2 }),
	aiScore: numeric("ai_score", { precision: 5, scale:  2 }),
	bonusScore: numeric("bonus_score", { precision: 5, scale:  2 }).default('0'),
	scoreBreakdown: jsonb("score_breakdown"),
	weaknesses: jsonb(),
	coachReview: text("coach_review"),
	coachIssues: jsonb("coach_issues"),
	coachExamples: jsonb("coach_examples"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_training_history_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_training_history_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "training_history_user_id_fkey"
		}),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarioConfig.id],
			name: "training_history_scenario_id_fkey"
		}),
	foreignKey({
			columns: [table.buyerPersonaId],
			foreignColumns: [buyerPersona.id],
			name: "training_history_buyer_persona_id_fkey"
		}),
]);

export const chatMessage = pgTable("chat_message", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	trainingId: uuid("training_id").notNull(),
	role: varchar({ length: 20 }).notNull(),
	content: text().notNull(),
	language: varchar({ length: 10 }).default('es'),
	metadata: jsonb(),
	scoreSignals: jsonb("score_signals"),
	deductionPoints: jsonb("deduction_points"),
	isFlagged: boolean("is_flagged").default(false),
	messageOrder: integer("message_order").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_chat_message_training").using("btree", table.trainingId.asc().nullsLast().op("int4_ops"), table.messageOrder.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.trainingId],
			foreignColumns: [trainingHistory.id],
			name: "chat_message_training_id_fkey"
		}).onDelete("cascade"),
]);

export const scoreDetail = pgTable("score_detail", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	trainingId: uuid("training_id").notNull(),
	messageId: uuid("message_id"),
	category: varchar({ length: 50 }).notNull(),
	dimension: varchar({ length: 50 }).notNull(),
	ruleScore: numeric("rule_score", { precision: 5, scale:  2 }).default('0'),
	aiScore: numeric("ai_score", { precision: 5, scale:  2 }).default('0'),
	maxScore: numeric("max_score", { precision: 5, scale:  2 }).notNull(),
	deductionReason: text("deduction_reason"),
	isViolation: boolean("is_violation").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_score_detail_training").using("btree", table.trainingId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.trainingId],
			foreignColumns: [trainingHistory.id],
			name: "score_detail_training_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [chatMessage.id],
			name: "score_detail_message_id_fkey"
		}),
]);

export const cases = pgTable("cases", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	title: varchar({ length: 200 }).notNull(),
	description: text(),
	source: varchar({ length: 50 }),
	buyerPersonaId: uuid("buyer_persona_id"),
	marketConfigId: uuid("market_config_id"),
	productType: varchar("product_type", { length: 100 }),
	conversationData: jsonb("conversation_data").notNull(),
	keyMoments: jsonb("key_moments"),
	bestResponses: jsonb("best_responses"),
	difficulty: integer().default(3),
	tags: text().array(),
	isActive: boolean("is_active").default(true),
	practiceCount: integer("practice_count").default(0),
	avgSimilarityScore: numeric("avg_similarity_score", { precision: 5, scale:  2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_cases_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.buyerPersonaId],
			foreignColumns: [buyerPersona.id],
			name: "cases_buyer_persona_id_fkey"
		}),
	foreignKey({
			columns: [table.marketConfigId],
			foreignColumns: [marketConfig.id],
			name: "cases_market_config_id_fkey"
		}),
	check("cases_difficulty_check", sql`(difficulty >= 1) AND (difficulty <= 5)`),
]);

export const wrongQuestions = pgTable("wrong_questions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	userId: uuid("user_id"),
	trainingId: uuid("training_id"),
	messageId: uuid("message_id"),
	category: varchar({ length: 50 }).notNull(),
	originalMessage: text("original_message"),
	userResponse: text("user_response"),
	idealResponse: text("ideal_response"),
	explanation: text(),
	relatedDimension: varchar("related_dimension", { length: 50 }),
	isPracticed: boolean("is_practiced").default(false),
	practiceCount: integer("practice_count").default(0),
	lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_wrong_questions_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "wrong_questions_user_id_fkey"
		}),
	foreignKey({
			columns: [table.trainingId],
			foreignColumns: [trainingHistory.id],
			name: "wrong_questions_training_id_fkey"
		}),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [chatMessage.id],
			name: "wrong_questions_message_id_fkey"
		}),
]);

export const helpRequests = pgTable("help_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	userId: uuid("user_id"),
	title: varchar({ length: 200 }).notNull(),
	description: text(),
	conversationContext: jsonb("conversation_context"),
	buyerType: varchar("buyer_type", { length: 100 }),
	productType: varchar("product_type", { length: 100 }),
	status: varchar({ length: 20 }).default('pending'),
	aiSuggestion: text("ai_suggestion"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_help_requests_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "help_requests_user_id_fkey"
		}),
]);
