import { relations } from "drizzle-orm/relations";
import { buyerPersona, scenarioConfig, marketConfig, users, trainingHistory, chatMessage, scoreDetail, cases, wrongQuestions, helpRequests } from "./schema";

export const scenarioConfigRelations = relations(scenarioConfig, ({one, many}) => ({
	buyerPersona: one(buyerPersona, {
		fields: [scenarioConfig.buyerPersonaId],
		references: [buyerPersona.id]
	}),
	marketConfig: one(marketConfig, {
		fields: [scenarioConfig.marketConfigId],
		references: [marketConfig.id]
	}),
	trainingHistories: many(trainingHistory),
}));

export const buyerPersonaRelations = relations(buyerPersona, ({many}) => ({
	scenarioConfigs: many(scenarioConfig),
	trainingHistories: many(trainingHistory),
	cases: many(cases),
}));

export const marketConfigRelations = relations(marketConfig, ({many}) => ({
	scenarioConfigs: many(scenarioConfig),
	cases: many(cases),
}));

export const trainingHistoryRelations = relations(trainingHistory, ({one, many}) => ({
	user: one(users, {
		fields: [trainingHistory.userId],
		references: [users.id]
	}),
	scenarioConfig: one(scenarioConfig, {
		fields: [trainingHistory.scenarioId],
		references: [scenarioConfig.id]
	}),
	buyerPersona: one(buyerPersona, {
		fields: [trainingHistory.buyerPersonaId],
		references: [buyerPersona.id]
	}),
	chatMessages: many(chatMessage),
	scoreDetails: many(scoreDetail),
	wrongQuestions: many(wrongQuestions),
}));

export const usersRelations = relations(users, ({many}) => ({
	trainingHistories: many(trainingHistory),
	wrongQuestions: many(wrongQuestions),
	helpRequests: many(helpRequests),
}));

export const chatMessageRelations = relations(chatMessage, ({one, many}) => ({
	trainingHistory: one(trainingHistory, {
		fields: [chatMessage.trainingId],
		references: [trainingHistory.id]
	}),
	scoreDetails: many(scoreDetail),
	wrongQuestions: many(wrongQuestions),
}));

export const scoreDetailRelations = relations(scoreDetail, ({one}) => ({
	trainingHistory: one(trainingHistory, {
		fields: [scoreDetail.trainingId],
		references: [trainingHistory.id]
	}),
	chatMessage: one(chatMessage, {
		fields: [scoreDetail.messageId],
		references: [chatMessage.id]
	}),
}));

export const casesRelations = relations(cases, ({one}) => ({
	buyerPersona: one(buyerPersona, {
		fields: [cases.buyerPersonaId],
		references: [buyerPersona.id]
	}),
	marketConfig: one(marketConfig, {
		fields: [cases.marketConfigId],
		references: [marketConfig.id]
	}),
}));

export const wrongQuestionsRelations = relations(wrongQuestions, ({one}) => ({
	user: one(users, {
		fields: [wrongQuestions.userId],
		references: [users.id]
	}),
	trainingHistory: one(trainingHistory, {
		fields: [wrongQuestions.trainingId],
		references: [trainingHistory.id]
	}),
	chatMessage: one(chatMessage, {
		fields: [wrongQuestions.messageId],
		references: [chatMessage.id]
	}),
}));

export const helpRequestsRelations = relations(helpRequests, ({one}) => ({
	user: one(users, {
		fields: [helpRequests.userId],
		references: [users.id]
	}),
}));