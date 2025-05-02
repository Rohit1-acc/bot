import { db } from '@db';
import { 
  users, 
  points, 
  countdowns, 
  tournaments,
  tournamentParticipants,
  tournamentMatchups,
  insertUserSchema, 
  insertPointsSchema, 
  insertCountdownSchema,
  insertTournamentSchema,
  insertTournamentParticipantSchema,
  insertTournamentMatchupSchema
} from '@shared/schema';
import { eq, desc, and, asc, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Storage service for managing Discord bot data
 */
export const storage = {
  /**
   * Get or create a user by Discord ID
   */
  async getUserByDiscordId(discordId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.discordId, discordId),
    });
    
    return user;
  },

  /**
   * Create a new user
   */
  async createUser(userData: z.infer<typeof insertUserSchema>) {
    try {
      const validatedData = insertUserSchema.parse(userData);
      const [newUser] = await db.insert(users)
        .values(validatedData)
        .returning();
      
      return newUser;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  },

  /**
   * Update a user's details
   */
  async updateUser(userId: number, userData: Partial<z.infer<typeof insertUserSchema>>) {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  },

  /**
   * Get points for a user
   */
  async getUserPoints(userId: number) {
    const pointsData = await db.query.points.findFirst({
      where: eq(points.userId, userId),
    });
    
    return pointsData;
  },

  /**
   * Add points to a user
   */
  async addPoints(userId: number, amount: number) {
    const existingPoints = await this.getUserPoints(userId);
    
    if (existingPoints) {
      const [updatedPoints] = await db.update(points)
        .set({ 
          amount: existingPoints.amount + amount,
          updatedAt: new Date(),
        })
        .where(eq(points.id, existingPoints.id))
        .returning();
      
      return updatedPoints;
    } else {
      const pointsData = {
        userId,
        amount,
      };
      
      try {
        const validatedData = insertPointsSchema.parse(pointsData);
        const [newPoints] = await db.insert(points)
          .values(validatedData)
          .returning();
        
        return newPoints;
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw error;
      }
    }
  },

  /**
   * Remove points from a user
   */
  async removePoints(userId: number, amount: number) {
    const existingPoints = await this.getUserPoints(userId);
    
    if (!existingPoints) {
      throw new Error(`No points found for user with ID ${userId}`);
    }
    
    const newAmount = Math.max(0, existingPoints.amount - amount);
    
    const [updatedPoints] = await db.update(points)
      .set({ 
        amount: newAmount,
        updatedAt: new Date(),
      })
      .where(eq(points.id, existingPoints.id))
      .returning();
    
    return updatedPoints;
  },

  /**
   * Get the leaderboard (top users by points)
   */
  async getLeaderboard(limit = 5) {
    const leaderboard = await db.query.points.findMany({
      orderBy: (points, { desc }) => [desc(points.amount)],
      limit,
      with: {
        user: true,
      },
    });
    
    return leaderboard;
  },

  /**
   * Get a user's rank on the leaderboard
   */
  async getUserRank(userId: number) {
    const allPointsEntries = await db.query.points.findMany({
      orderBy: (points, { desc }) => [desc(points.amount)],
    });
    
    const userIndex = allPointsEntries.findIndex(entry => entry.userId === userId);
    
    return userIndex !== -1 ? userIndex + 1 : null;
  },
  
  /**
   * Get all active countdowns
   */
  async getCountdowns() {
    const allCountdowns = await db.query.countdowns.findMany({
      where: eq(countdowns.isActive, true),
      orderBy: (countdowns, { asc }) => [asc(countdowns.targetDate)],
    });
    
    return allCountdowns;
  },
  
  /**
   * Get countdown by ID
   */
  async getCountdownById(id: number) {
    const countdown = await db.query.countdowns.findFirst({
      where: eq(countdowns.id, id),
    });
    
    return countdown;
  },
  
  /**
   * Create a new countdown
   */
  async createCountdown(countdownData: z.infer<typeof insertCountdownSchema>) {
    try {
      const validatedData = insertCountdownSchema.parse(countdownData);
      const [newCountdown] = await db.insert(countdowns)
        .values(validatedData)
        .returning();
      
      return newCountdown;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  },
  
  /**
   * Update a countdown
   */
  async updateCountdown(id: number, data: Partial<z.infer<typeof insertCountdownSchema>>) {
    const [updatedCountdown] = await db.update(countdowns)
      .set(data)
      .where(eq(countdowns.id, id))
      .returning();
    
    return updatedCountdown;
  },
  
  /**
   * Delete a countdown (mark as inactive)
   */
  async deleteCountdown(id: number) {
    const [deletedCountdown] = await db.update(countdowns)
      .set({ isActive: false })
      .where(eq(countdowns.id, id))
      .returning();
    
    return deletedCountdown;
  },

  /**
   * TOURNAMENT METHODS
   */

  /**
   * Get all tournaments
   */
  async getTournaments() {
    const allTournaments = await db.query.tournaments.findMany({
      orderBy: (tournaments, { desc }) => [desc(tournaments.createdAt)],
    });
    
    return allTournaments;
  },
  
  /**
   * Get tournament by ID with participants and matchups
   */
  async getTournamentById(id: number) {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, id),
      with: {
        participants: {
          orderBy: (participants, { asc }) => [asc(participants.seed)],
        },
        matchups: {
          orderBy: [
            asc(tournamentMatchups.roundNumber),
            asc(tournamentMatchups.matchNumber)
          ],
          with: {
            participant1: true,
            participant2: true,
            winner: true,
            loser: true,
          },
        },
      },
    });
    
    return tournament;
  },
  
  /**
   * Create a new tournament
   */
  async createTournament(tournamentData: z.infer<typeof insertTournamentSchema>) {
    try {
      const validatedData = insertTournamentSchema.parse(tournamentData);
      const [newTournament] = await db.insert(tournaments)
        .values(validatedData)
        .returning();
      
      return newTournament;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  },
  
  /**
   * Update a tournament
   */
  async updateTournament(id: number, data: Partial<z.infer<typeof insertTournamentSchema>>) {
    const [updatedTournament] = await db.update(tournaments)
      .set(data)
      .where(eq(tournaments.id, id))
      .returning();
    
    return updatedTournament;
  },
  
  /**
   * Add participant to a tournament
   */
  async addTournamentParticipant(participantData: z.infer<typeof insertTournamentParticipantSchema>) {
    try {
      const validatedData = insertTournamentParticipantSchema.parse(participantData);
      
      // Get current participant count for automatic seeding if not provided
      if (!validatedData.seed) {
        const existingParticipants = await db.query.tournamentParticipants.findMany({
          where: eq(tournamentParticipants.tournamentId, validatedData.tournamentId),
        });
        validatedData.seed = existingParticipants.length + 1;
      }
      
      const [newParticipant] = await db.insert(tournamentParticipants)
        .values(validatedData)
        .returning();
      
      return newParticipant;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  },
  
  /**
   * Get participants for a tournament
   */
  async getTournamentParticipants(tournamentId: number) {
    const participants = await db.query.tournamentParticipants.findMany({
      where: eq(tournamentParticipants.tournamentId, tournamentId),
      orderBy: (participants, { asc }) => [asc(participants.seed)],
    });
    
    return participants;
  },
  
  /**
   * Generate tournament bracket matchups
   * This creates a single-elimination bracket for the given participants
   */
  async generateTournamentBracket(tournamentId: number) {
    // Get tournament and participants
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });
    
    if (!tournament) {
      throw new Error(`Tournament with ID ${tournamentId} not found`);
    }
    
    const participants = await this.getTournamentParticipants(tournamentId);
    
    if (participants.length < 2) {
      throw new Error('Tournament must have at least 2 participants to generate a bracket');
    }
    
    // Determine number of rounds needed (log2 of participants, rounded up)
    const participantCount = participants.length;
    const roundsNeeded = Math.ceil(Math.log2(participantCount));
    const fullBracketSize = Math.pow(2, roundsNeeded);
    
    // Create matchups for first round with byes for incomplete brackets
    const matchups = [];
    
    // Update tournament with rounds info
    await this.updateTournament(tournamentId, {
      status: 'active',
      startedAt: new Date(),
      config: {
        ...tournament.config,
        rounds: roundsNeeded
      }
    });
    
    // Create first round matchups
    for (let i = 0; i < fullBracketSize / 2; i++) {
      const participant1Index = i;
      const participant2Index = fullBracketSize - 1 - i;
      
      const matchup: z.infer<typeof insertTournamentMatchupSchema> = {
        tournamentId,
        roundNumber: 1,
        matchNumber: i + 1,
        participant1Id: participant1Index < participantCount ? participants[participant1Index].id : null,
        participant2Id: participant2Index < participantCount ? participants[participant2Index].id : null,
        status: 'pending',
      };
      
      // If one participant is missing, the other advances automatically
      if (matchup.participant1Id && !matchup.participant2Id) {
        matchup.winnerId = matchup.participant1Id;
        matchup.status = 'completed';
      } else if (!matchup.participant1Id && matchup.participant2Id) {
        matchup.winnerId = matchup.participant2Id;
        matchup.status = 'completed';
      }
      
      try {
        const [newMatchup] = await db.insert(tournamentMatchups)
          .values(matchup)
          .returning();
        
        matchups.push(newMatchup);
      } catch (error) {
        console.error('Error creating matchup:', error);
      }
    }
    
    // Create placeholder matchups for remaining rounds
    let matchesInPreviousRound = fullBracketSize / 2;
    
    for (let round = 2; round <= roundsNeeded; round++) {
      const matchesInThisRound = matchesInPreviousRound / 2;
      
      for (let match = 1; match <= matchesInThisRound; match++) {
        const matchup: z.infer<typeof insertTournamentMatchupSchema> = {
          tournamentId,
          roundNumber: round,
          matchNumber: match,
          status: 'pending',
        };
        
        try {
          const [newMatchup] = await db.insert(tournamentMatchups)
            .values(matchup)
            .returning();
          
          matchups.push(newMatchup);
        } catch (error) {
          console.error('Error creating matchup:', error);
        }
      }
      
      matchesInPreviousRound = matchesInThisRound;
    }
    
    return matchups;
  },
  
  /**
   * Update match result
   */
  async updateMatchResult(matchId: number, winnerId: number, score1?: number, score2?: number) {
    // Get the match
    const match = await db.query.tournamentMatchups.findFirst({
      where: eq(tournamentMatchups.id, matchId),
    });
    
    if (!match) {
      throw new Error(`Match with ID ${matchId} not found`);
    }
    
    // Determine loser
    let loserId = null;
    if (match.participant1Id === winnerId) {
      loserId = match.participant2Id;
    } else if (match.participant2Id === winnerId) {
      loserId = match.participant1Id;
    } else {
      throw new Error('Winner must be one of the participants');
    }
    
    // Update match results
    const [updatedMatch] = await db.update(tournamentMatchups)
      .set({ 
        winnerId, 
        loserId,
        score1,
        score2,
        status: 'completed',
        completedTime: new Date(),
      })
      .where(eq(tournamentMatchups.id, matchId))
      .returning();
    
    // Advance winner to the next round if this isn't the final
    const tournament = await this.getTournamentById(match.tournamentId);
    const maxRounds = tournament.config?.rounds || 0;
    
    if (match.roundNumber < maxRounds) {
      const nextRound = match.roundNumber + 1;
      const nextMatchNumber = Math.ceil(match.matchNumber / 2);
      
      // Find next match
      const nextMatch = await db.query.tournamentMatchups.findFirst({
        where: and(
          eq(tournamentMatchups.tournamentId, match.tournamentId),
          eq(tournamentMatchups.roundNumber, nextRound),
          eq(tournamentMatchups.matchNumber, nextMatchNumber)
        ),
      });
      
      if (nextMatch) {
        // Determine which participant slot to fill based on match number parity
        const isOdd = match.matchNumber % 2 === 1;
        const updateData: Partial<z.infer<typeof insertTournamentMatchupSchema>> = {};
        
        if (isOdd) {
          updateData.participant1Id = winnerId;
        } else {
          updateData.participant2Id = winnerId;
        }
        
        await db.update(tournamentMatchups)
          .set(updateData)
          .where(eq(tournamentMatchups.id, nextMatch.id));
      }
    } else {
      // This was the final match, mark the winner and tournament as completed
      await db.update(tournamentParticipants)
        .set({ isWinner: true })
        .where(eq(tournamentParticipants.id, winnerId));
      
      await db.update(tournaments)
        .set({ 
          status: 'completed',
          completedAt: new Date() 
        })
        .where(eq(tournaments.id, match.tournamentId));
    }
    
    return updatedMatch;
  },
  
  /**
   * Get active tournaments
   */
  async getActiveTournaments() {
    const tournaments = await db.query.tournaments.findMany({
      where: eq(tournaments.status, 'active'),
      orderBy: (tournaments, { desc }) => [desc(tournaments.createdAt)],
    });
    
    return tournaments;
  },

  /**
   * GIVEAWAY METHODS
   */

  /**
   * Create a new giveaway
   */
  async createGiveaway(giveawayData: z.infer<typeof insertGiveawaySchema>) {
    try {
      const [newGiveaway] = await db.insert(giveaways)
        .values(giveawayData)
        .returning();
      
      return newGiveaway;
    } catch (error) {
      console.error('Error creating giveaway:', error);
      throw error;
    }
  },

  /**
   * Get giveaway by ID with entries
   */
  async getGiveawayById(id: number) {
    const giveaway = await db.query.giveaways.findFirst({
      where: eq(giveaways.id, id),
      with: {
        entries: true,
      },
    });
    
    return giveaway;
  },

  /**
   * Get all active giveaways
   */
  async getActiveGiveaways() {
    const active = await db.query.giveaways.findMany({
      where: eq(giveaways.status, 'active'),
      orderBy: (giveaways, { asc }) => [asc(giveaways.endTime)],
    });
    
    return active;
  },

  /**
   * Add an entry to a giveaway
   */
  async addGiveawayEntry(entryData: z.infer<typeof insertGiveawayEntrySchema>) {
    try {
      // Check if this user already entered
      const existingEntry = await db.query.giveawayEntries.findFirst({
        where: and(
          eq(giveawayEntries.giveawayId, entryData.giveawayId),
          eq(giveawayEntries.discordId, entryData.discordId)
        ),
      });
      
      if (existingEntry) {
        return existingEntry; // User already entered
      }
      
      const [newEntry] = await db.insert(giveawayEntries)
        .values(entryData)
        .returning();
      
      return newEntry;
    } catch (error) {
      console.error('Error adding giveaway entry:', error);
      throw error;
    }
  },

  /**
   * End a giveaway and randomly pick winners
   */
  async endGiveaway(giveawayId: number) {
    return await db.transaction(async (tx) => {
      // Get giveaway
      const giveaway = await tx.query.giveaways.findFirst({
        where: eq(giveaways.id, giveawayId),
        with: {
          entries: true,
        },
      });
      
      if (!giveaway) {
        throw new Error(`Giveaway with ID ${giveawayId} not found`);
      }
      
      if (giveaway.status !== 'active') {
        throw new Error(`Giveaway ${giveawayId} is already ${giveaway.status}`);
      }
      
      // Mark giveaway as ended
      await tx.update(giveaways)
        .set({ status: 'ended', updatedAt: new Date() })
        .where(eq(giveaways.id, giveawayId));
      
      // Pick random winners
      const entries = giveaway.entries;
      if (!entries || entries.length === 0) {
        return { giveaway, winners: [] };
      }
      
      const winnerCount = Math.min(giveaway.winnerCount, entries.length);
      const winners: GiveawayEntry[] = [];
      
      // Shuffle entries array (Fisher-Yates shuffle)
      for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
      }
      
      // Select winners from shuffled array
      for (let i = 0; i < winnerCount; i++) {
        const winner = entries[i];
        
        // Mark as winner
        await tx.update(giveawayEntries)
          .set({ isWinner: true })
          .where(eq(giveawayEntries.id, winner.id));
        
        winners.push(winner);
      }
      
      return { giveaway, winners };
    });
  },

  /**
   * Cancel a giveaway
   */
  async cancelGiveaway(giveawayId: number) {
    const [updatedGiveaway] = await db.update(giveaways)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(giveaways.id, giveawayId))
      .returning();
    
    return updatedGiveaway;
  },

  /**
   * Get entries for a giveaway
   */
  async getGiveawayEntries(giveawayId: number) {
    const entries = await db.query.giveawayEntries.findMany({
      where: eq(giveawayEntries.giveawayId, giveawayId),
      orderBy: (entries, { asc }) => [asc(entries.enteredAt)],
    });
    
    return entries;
  },

  /**
   * Get ending soon giveaways
   */
  async getEndingSoonGiveaways() {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    const giveaways = await db.query.giveaways.findMany({
      where: and(
        eq(giveaways.status, 'active'),
        gt(giveaways.endTime, now),
        lt(giveaways.endTime, oneHourFromNow)
      ),
      orderBy: (giveaways, { asc }) => [asc(giveaways.endTime)],
    });
    
    return giveaways;
  },

  /**
   * Check for ended giveaways that need to be processed
   */
  async checkForEndedGiveaways() {
    const now = new Date();
    
    const endedGiveaways = await db.query.giveaways.findMany({
      where: and(
        eq(giveaways.status, 'active'),
        lt(giveaways.endTime, now)
      ),
    });
    
    return endedGiveaways;
  }
};

export default storage;
