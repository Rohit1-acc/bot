import { db } from "./index";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

const users = [
  {
    username: "NeoRacer",
    discordId: "123456789012345678",
    avatarUrl: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80",
  },
  {
    username: "DataGhost",
    discordId: "234567890123456789",
    avatarUrl: "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80",
  },
  {
    username: "VirtualSamurai",
    discordId: "345678901234567890",
    avatarUrl: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80",
  },
  {
    username: "CyberProphet",
    discordId: "456789012345678901",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80",
  },
  {
    username: "SynthWave",
    discordId: "567890123456789012",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80",
  }
];

const userPoints = [
  { amount: 12450 },
  { amount: 9782 },
  { amount: 8540 },
  { amount: 6205 },
  { amount: 4870 },
];

async function seed() {
  try {
    console.log("Starting database seed...");
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const pointsAmount = userPoints[i].amount;
      
      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(schema.users.discordId, user.discordId),
      });
      
      let userId: number;
      
      if (existingUser) {
        console.log(`User ${user.username} already exists, skipping creation`);
        userId = existingUser.id;
        
        // Update avatar URL if needed
        if (existingUser.avatarUrl !== user.avatarUrl) {
          await db.update(schema.users)
            .set({ avatarUrl: user.avatarUrl })
            .where(eq(schema.users.id, userId));
        }
      } else {
        // Create new user
        console.log(`Creating user ${user.username}...`);
        const [newUser] = await db.insert(schema.users)
          .values(user)
          .returning();
        userId = newUser.id;
      }
      
      // Check if points record exists
      const existingPoints = await db.query.points.findFirst({
        where: eq(schema.points.userId, userId),
      });
      
      if (existingPoints) {
        console.log(`Points for user ${user.username} already exist, updating...`);
        await db.update(schema.points)
          .set({ amount: pointsAmount })
          .where(eq(schema.points.id, existingPoints.id));
      } else {
        console.log(`Creating points for user ${user.username}...`);
        await db.insert(schema.points)
          .values({
            userId,
            amount: pointsAmount,
          });
      }
    }
    
    console.log("Database seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
