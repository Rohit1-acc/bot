import { pgTable, text, serial, integer, boolean, timestamp, varchar, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  discordId: varchar("discord_id", { length: 255 }).notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  points: many(points),
}));

// Points table
export const points = pgTable("points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  amount: integer("amount").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Points relations
export const pointsRelations = relations(points, ({ one }) => ({
  user: one(users, {
    fields: [points.userId],
    references: [users.id],
  }),
}));

// Countdowns table - for admin-created event countdowns
export const countdowns = pgTable("countdowns", {
  id: serial("id").primaryKey(),
  eventName: text("event_name").notNull(),
  description: text("description"),
  channelId: varchar("channel_id", { length: 255 }).notNull(),
  messageId: varchar("message_id", { length: 255 }),
  creatorId: varchar("creator_id", { length: 255 }).notNull(),
  targetDate: timestamp("target_date").notNull(),
  embedColor: integer("embed_color").default(0x00F0FF),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  discordId: true,
  avatarUrl: true,
});

export const insertPointsSchema = createInsertSchema(points).pick({
  userId: true,
  amount: true,
});

export const insertCountdownSchema = createInsertSchema(countdowns).pick({
  eventName: true,
  description: true,
  channelId: true,
  messageId: true,
  creatorId: true,
  targetDate: true,
  embedColor: true,
  isActive: true,
});

// Tournaments table - for organizing competitions
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  game: text("game").notNull(),
  type: text("type").notNull().default("bracket"), // bracket, round-robin, etc.
  channelId: varchar("channel_id", { length: 255 }).notNull(),
  messageId: varchar("message_id", { length: 255 }),
  creatorId: varchar("creator_id", { length: 255 }).notNull(),
  status: text("status").notNull().default("created"), // created, active, completed
  imageUrl: text("image_url"),
  config: json("config").$type<{
    teams?: boolean;
    maxParticipants?: number;
    rounds?: number;
    style?: string;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// Tournament participants
export const tournamentParticipants = pgTable("tournament_participants", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id).notNull(),
  participantName: text("participant_name").notNull(),
  participantDiscordId: varchar("participant_discord_id", { length: 255 }),
  participantAvatarUrl: text("participant_avatar_url"),
  seed: integer("seed"),
  teamName: text("team_name"),
  teamLogo: text("team_logo"),
  isEliminated: boolean("is_eliminated").default(false),
  isWinner: boolean("is_winner").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tournament matchups
export const tournamentMatchups = pgTable("tournament_matchups", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id).notNull(),
  roundNumber: integer("round_number").notNull(),
  matchNumber: integer("match_number").notNull(),
  participant1Id: integer("participant1_id").references(() => tournamentParticipants.id),
  participant2Id: integer("participant2_id").references(() => tournamentParticipants.id),
  winnerId: integer("winner_id").references(() => tournamentParticipants.id),
  loserId: integer("loser_id").references(() => tournamentParticipants.id),
  score1: integer("score1"),
  score2: integer("score2"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed
  scheduledTime: timestamp("scheduled_time"),
  completedTime: timestamp("completed_time"),
  messageId: varchar("message_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const tournamentRelations = relations(tournaments, ({ many }) => ({
  participants: many(tournamentParticipants),
  matchups: many(tournamentMatchups),
}));

export const tournamentParticipantsRelations = relations(tournamentParticipants, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [tournamentParticipants.tournamentId],
    references: [tournaments.id],
  }),
  matchesAsParticipant1: many(tournamentMatchups, { relationName: "participant1" }),
  matchesAsParticipant2: many(tournamentMatchups, { relationName: "participant2" }),
  matchesAsWinner: many(tournamentMatchups, { relationName: "winner" }),
  matchesAsLoser: many(tournamentMatchups, { relationName: "loser" }),
}));

export const tournamentMatchupsRelations = relations(tournamentMatchups, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentMatchups.tournamentId],
    references: [tournaments.id],
  }),
  participant1: one(tournamentParticipants, {
    fields: [tournamentMatchups.participant1Id],
    references: [tournamentParticipants.id],
    relationName: "participant1",
  }),
  participant2: one(tournamentParticipants, {
    fields: [tournamentMatchups.participant2Id],
    references: [tournamentParticipants.id],
    relationName: "participant2",
  }),
  winner: one(tournamentParticipants, {
    fields: [tournamentMatchups.winnerId],
    references: [tournamentParticipants.id],
    relationName: "winner",
  }),
  loser: one(tournamentParticipants, {
    fields: [tournamentMatchups.loserId],
    references: [tournamentParticipants.id],
    relationName: "loser",
  }),
}));

// Schemas for validation
export const insertTournamentSchema = createInsertSchema(tournaments).pick({
  name: true,
  description: true,
  game: true,
  type: true,
  channelId: true,
  messageId: true,
  creatorId: true,
  status: true,
  imageUrl: true,
  config: true,
});

export const insertTournamentParticipantSchema = createInsertSchema(tournamentParticipants).pick({
  tournamentId: true,
  participantName: true,
  participantDiscordId: true,
  participantAvatarUrl: true,
  seed: true,
  teamName: true,
  teamLogo: true,
  isEliminated: true,
  isWinner: true,
});

export const insertTournamentMatchupSchema = createInsertSchema(tournamentMatchups).pick({
  tournamentId: true,
  roundNumber: true,
  matchNumber: true,
  participant1Id: true,
  participant2Id: true,
  winnerId: true,
  loserId: true,
  score1: true,
  score2: true,
  status: true,
  scheduledTime: true,
  completedTime: true,
  messageId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPoints = z.infer<typeof insertPointsSchema>;
export type InsertCountdown = z.infer<typeof insertCountdownSchema>;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type InsertTournamentParticipant = z.infer<typeof insertTournamentParticipantSchema>;
export type InsertTournamentMatchup = z.infer<typeof insertTournamentMatchupSchema>;

export type User = typeof users.$inferSelect;
export type Points = typeof points.$inferSelect;
export type Countdown = typeof countdowns.$inferSelect;
// Giveaway table
export const giveaways = pgTable("giveaways", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  creatorId: text("creator_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  endTime: timestamp("end_time").notNull(),
  winnerCount: integer("winner_count").default(1).notNull(),
  status: text("status").default("active").notNull(), // active, ended, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const giveawayEntries = pgTable("giveaway_entries", {
  id: serial("id").primaryKey(),
  giveawayId: integer("giveaway_id").references(() => giveaways.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  discordId: text("discord_id").notNull(),
  username: text("username").notNull(),
  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  isWinner: boolean("is_winner").default(false).notNull(),
});

export const giveawaysRelations = relations(giveaways, ({ many }) => ({
  entries: many(giveawayEntries),
}));

export const giveawayEntriesRelations = relations(giveawayEntries, ({ one }) => ({
  giveaway: one(giveaways, { fields: [giveawayEntries.giveawayId], references: [giveaways.id] }),
  user: one(users, { fields: [giveawayEntries.userId], references: [users.id] }),
}));

export const insertGiveawaySchema = createInsertSchema(giveaways).pick({
  name: true,
  description: true,
  creatorId: true,
  channelId: true,
  messageId: true,
  endTime: true,
  winnerCount: true,
  status: true,
});

export const insertGiveawayEntrySchema = createInsertSchema(giveawayEntries).pick({
  giveawayId: true,
  userId: true,
  discordId: true,
  username: true,
  isWinner: true,
});

export type InsertGiveaway = z.infer<typeof insertGiveawaySchema>;
export type InsertGiveawayEntry = z.infer<typeof insertGiveawayEntrySchema>;
export type Giveaway = typeof giveaways.$inferSelect;
export type GiveawayEntry = typeof giveawayEntries.$inferSelect;

export type Tournament = typeof tournaments.$inferSelect;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type TournamentMatchup = typeof tournamentMatchups.$inferSelect;
