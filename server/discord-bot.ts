import { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  Events, 
  Message, 
  PermissionsBitField,
  PermissionFlagsBits,
  EmbedBuilder, 
  Colors, 
  AttachmentBuilder, 
  ChannelType,
  TextChannel,
  User,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
  MessageActionRowComponentBuilder,
  time
} from 'discord.js';
import { db } from '@db';
import { 
  points, 
  users, 
  countdowns, 
  giveaways,
  giveawayEntries
} from '@shared/schema';
import { eq, desc, and, gt, lt, asc } from 'drizzle-orm';
import { createLeaderboardImage } from './image-generator';

// Admin user IDs that can use privileged commands
const ADMIN_IDS = [
  '1194249608939962428',
  '1194229958646698064', 
  '1215179666692771843',
  '1242537266878873743',
  '717258358184345633',
];

// Command prefix
const PREFIX = '!';

// Theme colors and emoji
const THEME = {
  PRIMARY: 0x00F0FF, // Cyber blue
  SUCCESS: 0x47F8A8, // Neon green
  ERROR: 0xFF3366,   // Hot pink
  WARNING: 0xFFCC00, // Bright yellow
  INFO: 0x8A2BE2,    // Purple
  RANK: {
    1: '🥇',
    2: '🥈',
    3: '🥉',
    4: '4️⃣',
    5: '5️⃣'
  }
};

// Event Avengers banner art
const EVENT_BANNER = `
\`\`\`
# Welcome to Event Avenger Bot System!
\`\`\``;

class DiscordBot {
  public client: Client;
  private token: string;
  private status: {
    connection: {
      status: 'online' | 'offline' | 'reconnecting';
      uptime: string;
      startTime: Date | null;
    };
    database: {
      status: 'connected' | 'disconnected' | 'connecting';
      lastSync: string;
    };
    autoReconnect: {
      enabled: boolean;
      lastReconnection: string | null;
    };
  };

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });

    this.token = process.env.DISCORD_BOT_TOKEN || '';
    
    this.status = {
      connection: {
        status: 'offline',
        uptime: 'N/A',
        startTime: null,
      },
      database: {
        status: 'disconnected',
        lastSync: 'N/A',
      },
      autoReconnect: {
        enabled: true,
        lastReconnection: null,
      },
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on(Events.ClientReady, () => {
      console.log(`Logged in as ${this.client.user?.tag}`);
      this.status.connection.status = 'online';
      this.status.connection.startTime = new Date();
      this.status.database.status = 'connected';
      this.status.database.lastSync = new Date().toISOString();
      
      // Set up a timed interval to update all active countdowns every hour
      setInterval(async () => {
        try {
          await this.updateCountdowns();
          console.log('Updated all active countdowns');
        } catch (error) {
          console.error('Error updating countdowns:', error);
        }
      }, 60 * 60 * 1000); // Every hour
    });

    this.client.on(Events.MessageCreate, this.handleMessage.bind(this));

    this.client.on(Events.Error, (error) => {
      console.error('Discord client error:', error);
      this.status.connection.status = 'reconnecting';
    });

    this.client.on(Events.Invalidated, () => {
      console.log('Client session invalidated, reconnecting...');
      this.status.connection.status = 'reconnecting';
      this.status.autoReconnect.lastReconnection = new Date().toISOString();
      this.login();
    });
  }

  private async handleMessage(message: Message): Promise<void> {
    // Ignore messages from bots
    if (message.author.bot) return;

    const content = message.content.trim();
    
    // Check if the message starts with our prefix
    if (!content.startsWith(PREFIX)) return;
    
    // Extract the command and arguments
    const args = content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();
    
    // Handle commands
    switch (command) {
      case 'givepoints':
        await this.handleGivePointsCommand(message, args);
        break;
      case 'removepoints':
        await this.handleRemovePointsCommand(message, args);
        break;
      case 'leaderboard':
      case 'lb':
        await this.handleLeaderboardCommand(message, args);
        break;
      case 'points':
      case 'mypoints':
        await this.handlePointsCommand(message, args);
        break;
      case 'help':
        await this.handleHelpCommand(message);
        break;
      case 'ophelp':
      case 'adminhelp':
        await this.handleAdminHelpCommand(message);
        break;
      case 'rank':
        await this.handleRankCommand(message, args);
        break;
      case 'shop':
        await this.handleShopCommand(message);
        break;
      case 'earnpoints':
        await this.handleEarnPointsCommand(message);
        break;
      case 'msg':
      case 'message':
        await this.handleMessageCommand(message, args, content);
        break;
      case 'announce':
      case 'announcement':
        await this.handleAnnounceCommand(message, args, content);
        break;
      case 'bet':
        await this.handleBetCommand(message, args);
        break;
      case 'countdown':
        await this.handleCountdownCommand(message, args);
        break;
      case 'listcountdowns':
      case 'countdowns':
        await this.handleListCountdownsCommand(message);
        break;
      case 'deletecountdown':
      case 'removecountdown':
        await this.handleDeleteCountdownCommand(message, args);
        break;

      // Giveaway commands
      case 'giveaway':
        await this.handleGiveawayCommand(message, args);
        break;
      case 'giveaways':
        await this.handleListGiveawaysCommand(message);
        break;
        
      // Moderation commands
      case 'mute':
        await this.handleMuteCommand(message, args);
        break;
      case 'unmute':
        await this.handleUnmuteCommand(message, args);
        break;
      case 'timeout':
        await this.handleTimeoutCommand(message, args);
        break;
      case 'removetimeout':
        await this.handleRemoveTimeoutCommand(message, args);
        break;
      case 'lock':
      case 'lockchannel':
        await this.handleLockChannelCommand(message, args);
        break;
      case 'unlock':
      case 'unlockchannel':
        await this.handleUnlockChannelCommand(message, args);
        break;
      case 'close':
      case 'closechannel':
        await this.handleCloseChannelCommand(message, args);
        break;
      case 'open':
      case 'openchannel':
        await this.handleOpenChannelCommand(message, args);
        break;
      case 'slowmode':
        await this.handleSlowmodeCommand(message, args);
        break;
      case 'purge':
      case 'clear':
        await this.handlePurgeCommand(message, args);
        break;
      case 'nuke':
        await this.handleNukeCommand(message, args);
        break;
      case 'kick':
        await this.handleKickCommand(message, args);
        break;
      case 'ban':
        await this.handleBanCommand(message, args);
        break;
      case 'unban':
        await this.handleUnbanCommand(message, args);
        break;
      case 'modhelp':
        await this.handleModHelpCommand(message);
        break;
      // Note: Accept/Decline and choice commands are now all handled through buttons
    }
  }
  
  private async handleHelpCommand(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚡ Event Avengers Command Center ⚡')
      .setColor(THEME.INFO)
      .setDescription(`${EVENT_BANNER}\n\n**Welcome to the Event Avengers Points System!**\n\nTrack your points, climb the ranks, and compete for the top positions on the leaderboard.`)
      .addFields(
        { 
          name: '📊 LEADERBOARD COMMANDS',
          value: 
            `\`${PREFIX}leaderboard\` or \`${PREFIX}lb\` - View top 10 users\n` +
            `\`${PREFIX}lb <number>\` - Show top X users (from 1-15)`
        },
        { 
          name: '👤 USER COMMANDS',  
          value: 
            `\`${PREFIX}points\` or \`${PREFIX}mypoints\` - Check your current points\n` +
            `\`${PREFIX}rank\` - Check your position in the rankings\n` +
            `\`${PREFIX}rank @user\` - Check another user's rank\n` +
            `\`${PREFIX}shop\` - View available rewards to spend points on\n` +
            `\`${PREFIX}earnpoints\` - Learn how to earn points in the server\n` +
            `\`${PREFIX}help\` - Display this command list`
        },
        {
          name: '🎲 BETTING COMMANDS',
          value:
            `\`${PREFIX}bet @user <amount>\` - Challenge someone to a coin flip bet\n` +
            `*User will get buttons to accept or decline the bet*\n` +
            `*User will get buttons to choose heads or tails during the game*`
        },
        {
          name: '🎁 GIVEAWAY COMMANDS',
          value:
            `\`${PREFIX}giveaways\` - Show active giveaways\n` +
            `*Use buttons to enter giveaways!*`
        },
        {
          name: '🛡️ MODERATION',
          value:
            `\`${PREFIX}modhelp\` - Show moderation commands and usage\n` +
            `*Only server moderators can use these commands*`
        }
      )
      .setThumbnail('https://cdn.discordapp.com/icons/1342945804985307198/7d65a9a24b64385086f6d2879fa82bb4.webp?size=80&quality=lossless')
      .setFooter({ text: '✧✦✧ Event Avengers Points v1.2 ✧✦✧ Use !ophelp for admin commands ✧✦✧' });
    
    await message.reply({ embeds: [embed] });
  }
  
  private async handleAdminHelpCommand(message: Message): Promise<void> {
    // Check if user is in admin list
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Event Avengers Admin Command Center ⚙️')
      .setColor(THEME.WARNING)
      .setDescription(`${EVENT_BANNER}\n\n**Admin Command Reference**\n\nThese commands are restricted to server administrators only.`)
      .addFields(
        { 
          name: '💰 POINTS MANAGEMENT',
          value: 
            `\`${PREFIX}givepoints @user <amount>\` - Award points to a user\n` +
            `\`${PREFIX}removepoints @user <amount>\` - Deduct points from a user`
        },
        { 
          name: '🗣️ MESSAGE COMMANDS',  
          value: 
            `\`${PREFIX}msg <message>\` - Make the bot send a custom message\n` +
            `\`${PREFIX}announce <message>\` - Send an announcement to all channels`
        },
        {
          name: '⏰ COUNTDOWN MANAGEMENT',
          value:
            `\`${PREFIX}countdown "Event Name" MM/DD/YYYY [description]\` - Create event countdown\n` +
            `\`${PREFIX}countdowns\` - List all active countdowns\n` +
            `\`${PREFIX}deletecountdown <id>\` - Remove a countdown by its ID`
        },

        {
          name: '🎁 GIVEAWAY MANAGEMENT',
          value:
            `\`${PREFIX}giveaway create "Prize Name" <duration>\` - Create a new giveaway\n` +
            `\`${PREFIX}giveaway end <id>\` - End a giveaway and pick winners\n` +
            `\`${PREFIX}giveaway cancel <id>\` - Cancel an active giveaway`
        }
      )
      .setThumbnail('https://cdn.discordapp.com/icons/1342945804985307198/7d65a9a24b64385086f6d2879fa82bb4.webp?size=80&quality=lossless')
      .setFooter({ text: '✧✦✧ Event Avengers Admin Tools v1.2 ✧✦✧ RESTRICTED COMMANDS ✧✦✧' });
    
    await message.reply({ embeds: [embed] });
  }
  
  private async handlePointsCommand(message: Message, args: string[]): Promise<void> {
    try {
      // Get the user's points
      const user = await db.query.users.findFirst({
        where: eq(users.discordId, message.author.id),
      });
      
      if (!user) {
        const embed = new EmbedBuilder()
          .setTitle('💠 Points Status: Not Found')
          .setDescription("You don't have any points in the system yet!")
          .setColor(THEME.WARNING)
          .setThumbnail('https://cdn.discordapp.com/icons/1342945804985307198/7d65a9a24b64385086f6d2879fa82bb4.webp?size=80&quality=lossless')
          .addFields({
            name: 'How to earn points',
            value: 'Server administrators can award you points for participation and contributions!'
          })
          .setFooter({ text: '⚡ Start your journey to the top of the leaderboard! ⚡' });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      const userPoints = await db.query.points.findFirst({
        where: eq(points.userId, user.id),
      });
      
      if (!userPoints) {
        const embed = new EmbedBuilder()
          .setTitle('💠 Points Status: None')
          .setDescription("You don't have any points yet!")
          .setColor(THEME.WARNING)
          .setThumbnail('https://cdn.discordapp.com/icons/1342945804985307198/7d65a9a24b64385086f6d2879fa82bb4.webp?size=80&quality=lossless')
          .addFields({
            name: 'How to earn points',
            value: 'Server administrators can award you points for participation and contributions!'
          })
          .setFooter({ text: '⚡ Start your journey to the top of the leaderboard! ⚡' });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Get user's rank and stats
      const allUsers = await db.query.points.findMany({
        orderBy: (points, { desc }) => [desc(points.amount)],
      });
      
      const userRank = allUsers.findIndex(entry => entry.userId === user.id) + 1;
      const totalUsers = allUsers.length;
      const topPercent = Math.round((userRank / totalUsers) * 100);
      
      // Get rank emoji
      const rankEmoji = userRank <= 5 ? THEME.RANK[userRank as keyof typeof THEME.RANK] : `#${userRank}`;
      
      // Format points with commas for better readability
      const formattedPoints = userPoints.amount.toLocaleString();
      
      const embed = new EmbedBuilder()
        .setTitle(`💠 Event Avengers Profile: ${user.username}`)
        .setColor(THEME.PRIMARY)
        .setDescription(`You currently have **${formattedPoints}** points!`)
        .addFields(
          { 
            name: '🏆 Rank', 
            value: `${rankEmoji} of ${totalUsers} users`, 
            inline: true 
          },
          { 
            name: '📊 Percentile', 
            value: `Top ${topPercent}%`, 
            inline: true 
          },
          { 
            name: '🕒 Last Updated', 
            value: `<t:${Math.floor(new Date(userPoints.updatedAt).getTime() / 1000)}:R>`, 
            inline: true 
          }
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ 
          text: '✧✦✧ Keep earning to climb the Event Avengers leaderboard! ✧✦✧'
        });
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching user points:', error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('⚠️ System Error')
        .setDescription('An error occurred while fetching your points data.')
        .setColor(THEME.ERROR)
        .setFooter({ text: 'Please try again later.' });
      
      await message.reply({ embeds: [errorEmbed] });
    }
  }
  
  private async handleRankCommand(message: Message, args: string[]): Promise<void> {
    try {
      // Check if a user is mentioned
      const targetUser = message.mentions.users.first() || message.author;
      
      // Find the user in the database
      const user = await db.query.users.findFirst({
        where: eq(users.discordId, targetUser.id),
      });
      
      if (!user) {
        await message.reply(`${targetUser.id === message.author.id ? "You don't" : `${targetUser.username} doesn't`} have any points yet!`);
        return;
      }
      
      // Get user's points
      const userPoints = await db.query.points.findFirst({
        where: eq(points.userId, user.id),
      });
      
      if (!userPoints) {
        await message.reply(`${targetUser.id === message.author.id ? "You don't" : `${targetUser.username} doesn't`} have any points yet!`);
        return;
      }
      
      // Get all users for ranking
      const allUsers = await db.query.points.findMany({
        orderBy: (points, { desc }) => [desc(points.amount)],
        with: {
          user: true,
        },
      });
      
      const rankIndex = allUsers.findIndex(entry => entry.userId === user.id);
      
      if (rankIndex === -1) {
        await message.reply(`${targetUser.id === message.author.id ? "You don't" : `${targetUser.username} doesn't`} have a rank yet!`);
        return;
      }
      
      const rank = rankIndex + 1;
      const totalUsers = allUsers.length;
      
      // Get users around the target user for context (2 above, 2 below if available)
      const startIndex = Math.max(0, rankIndex - 2);
      const endIndex = Math.min(totalUsers, rankIndex + 3);
      const nearbyUsers = allUsers.slice(startIndex, endIndex);
      
      // Get rank emoji
      const rankEmoji = rank <= 5 ? THEME.RANK[rank as keyof typeof THEME.RANK] : `#${rank}`;
      
      // Format points with commas for better readability
      const formattedPoints = userPoints.amount.toLocaleString();
      
      // Create the embed
      const embed = new EmbedBuilder()
        .setTitle(`🏆 Rank: ${rankEmoji}`)
        .setDescription(`${targetUser.id === message.author.id ? "Your" : `${targetUser.username}'s`} position on the Event Avengers leaderboard`)
        .setColor(THEME.PRIMARY)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: '💠 Points', value: `\`${formattedPoints}\``, inline: true },
          { name: '👥 Total Users', value: `\`${totalUsers}\``, inline: true },
          { name: '📊 Percentile', value: `Top \`${Math.round((rank / totalUsers) * 100)}%\``, inline: true }
        );
      
      // Removed nearby rankings section that was interfering with giving points
      
      embed.setFooter({ text: '✧✦✧ Event Avengers Points v1.1 ✧✦✧ Updated rankings ✧✦✧' });
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching rank:', error);
      await message.reply('An error occurred while fetching the rank. Please try again later.');
    }
  }

  private async handleGivePointsCommand(message: Message, args: string[]): Promise<void> {
    // Check if user is in admin list
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    if (args.length < 2 || message.mentions.users.size === 0) {
      const embed = new EmbedBuilder()
        .setTitle('Command Usage')
        .setDescription(`\`${PREFIX}givepoints @user <amount>\``)
        .setColor(0x00F0FF)
        .addFields(
          { name: 'Example', value: `\`${PREFIX}givepoints @EventUser 100\`` },
          { name: 'Note', value: 'You must mention a user and provide a positive number of points.' }
        );
      
      await message.reply({ embeds: [embed] });
      return;
    }

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) {
      await message.reply('Please mention a user to give points to.');
      return;
    }

    // Get the amount from the argument that comes after the mention
    const amountArg = args.find(arg => !arg.startsWith('<@') && !arg.includes('>'));
    const pointsToAdd = amountArg ? parseInt(amountArg, 10) : NaN;
    
    if (isNaN(pointsToAdd) || pointsToAdd <= 0) {
      await message.reply('Please provide a valid positive number of points.');
      return;
    }

    try {
      // Find or create user
      let user = await db.query.users.findFirst({
        where: eq(users.discordId, mentionedUser.id),
      });

      if (!user) {
        const [newUser] = await db.insert(users)
          .values({
            discordId: mentionedUser.id,
            username: mentionedUser.username,
            avatarUrl: mentionedUser.displayAvatarURL(),
          })
          .returning();
        user = newUser;
      }

      // Find existing points or create new entry
      const existingPoints = await db.query.points.findFirst({
        where: eq(points.userId, user.id),
      });

      if (existingPoints) {
        await db.update(points)
          .set({ 
            amount: existingPoints.amount + pointsToAdd,
            updatedAt: new Date(),
          })
          .where(eq(points.id, existingPoints.id));
      } else {
        await db.insert(points)
          .values({
            userId: user.id,
            amount: pointsToAdd,
          });
      }

      this.status.database.lastSync = new Date().toISOString();
      
      await message.reply(`Successfully added ${pointsToAdd} points to ${mentionedUser.username}!`);
    } catch (error) {
      console.error('Error giving points:', error);
      await message.reply('An error occurred while giving points. Please try again later.');
    }
  }

  private async handleRemovePointsCommand(message: Message, args: string[]): Promise<void> {
    // Check if user is in admin list
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    if (args.length < 2 || message.mentions.users.size === 0) {
      const embed = new EmbedBuilder()
        .setTitle('Command Usage')
        .setDescription(`\`${PREFIX}removepoints @user <amount>\``)
        .setColor(0x00F0FF)
        .addFields(
          { name: 'Example', value: `\`${PREFIX}removepoints @EventUser 50\`` },
          { name: 'Note', value: 'You must mention a user and provide a positive number of points to remove.' }
        );
      
      await message.reply({ embeds: [embed] });
      return;
    }

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) {
      await message.reply('Please mention a user to remove points from.');
      return;
    }

    // Get the amount from the argument that comes after the mention
    const amountArg = args.find(arg => !arg.startsWith('<@') && !arg.includes('>'));
    const pointsToRemove = amountArg ? parseInt(amountArg, 10) : NaN;
    
    if (isNaN(pointsToRemove) || pointsToRemove <= 0) {
      await message.reply('Please provide a valid positive number of points to remove.');
      return;
    }

    try {
      // Find user
      const user = await db.query.users.findFirst({
        where: eq(users.discordId, mentionedUser.id),
      });

      if (!user) {
        await message.reply(`${mentionedUser.username} has no points to remove.`);
        return;
      }

      // Find existing points
      const existingPoints = await db.query.points.findFirst({
        where: eq(points.userId, user.id),
      });

      if (!existingPoints) {
        await message.reply(`${mentionedUser.username} has no points to remove.`);
        return;
      }

      const newAmount = Math.max(0, existingPoints.amount - pointsToRemove);
      
      await db.update(points)
        .set({ 
          amount: newAmount,
          updatedAt: new Date(),
        })
        .where(eq(points.id, existingPoints.id));

      this.status.database.lastSync = new Date().toISOString();
      
      await message.reply(`Successfully removed ${pointsToRemove} points from ${mentionedUser.username}!`);
    } catch (error) {
      console.error('Error removing points:', error);
      await message.reply('An error occurred while removing points. Please try again later.');
    }
  }

  private async handleLeaderboardCommand(message: Message, args: string[]): Promise<void> {
    try {
      // Show a "Loading..." message while we generate the image
      const loadingMessage = await message.reply('🔄 Generating leaderboard image...');
      
      // Default limit is 10, but user can specify more (up to 15)
      let limit = 10;
      const limitArg = args.find(arg => !isNaN(parseInt(arg, 10)));
      
      if (limitArg) {
        const requestedLimit = parseInt(limitArg, 10);
        // Cap at 15 to prevent huge images
        limit = Math.min(Math.max(1, requestedLimit), 15);
      }
      
      // Get users by points
      const leaderboardData = await db.query.points.findMany({
        orderBy: (points, { desc }) => [desc(points.amount)],
        limit,
        with: {
          user: true,
        },
      });

      if (leaderboardData.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🏆 Empty Leaderboard')
          .setDescription('No points data available yet!')
          .setColor(THEME.WARNING)
          .setThumbnail('https://cdn.discordapp.com/icons/1342945804985307198/7d65a9a24b64385086f6d2879fa82bb4.webp?size=80&quality=lossless')
          .setFooter({ text: '⚡ Points will appear once users start earning them! ⚡' });
          
        await loadingMessage.edit({ content: '', embeds: [embed] });
        return;
      }

      // Use the image-generator to create a beautiful leaderboard image
      // Using direct PNG instead of WEBP for better compatibility with canvas
      const serverIconUrl = 'https://cdn.discordapp.com/icons/1342945804985307198/7d65a9a24b64385086f6d2879fa82bb4.png?size=128';
      
      // Import the createLeaderboardImage function dynamically to avoid circular dependencies
      const { createLeaderboardImage } = await import('./image-generator');
      const leaderboardImage = await createLeaderboardImage(leaderboardData, serverIconUrl);
      
      // Create embed with the image
      const embed = new EmbedBuilder()
        .setTitle('🏆 Event Avengers Leaderboard 🏆')
        .setColor(THEME.PRIMARY)
        .setDescription(`${EVENT_BANNER}\n\n**Top ${limit} point earners in the server**`)
        .setImage('attachment://leaderboard.png')
        .setFooter({ 
          text: `✧✦✧ Event Avengers Points v1.1 ✧✦✧`
        });

      // Edit the loading message with our new embed and attachment
      await loadingMessage.edit({ 
        content: '', 
        embeds: [embed],
        files: [leaderboardImage]
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('⚠️ System Error')
        .setDescription('An error occurred while generating the leaderboard image.')
        .setColor(THEME.ERROR)
        .setFooter({ text: 'Please try again later.' });
      
      try {
        // Try to find any existing loading message and edit it
        const messages = await message.channel.messages.fetch({ limit: 10 });
        const botMessages = messages.filter(m => 
          m.author.id === this.client.user?.id && 
          m.content.includes('Generating leaderboard')
        );
        
        if (botMessages.size > 0) {
          await botMessages.first()?.edit({ content: '', embeds: [errorEmbed] });
        } else {
          await message.reply({ embeds: [errorEmbed] });
        }
      } catch (replyError) {
        console.error('Error replying with error message:', replyError);
        await message.reply('An error occurred while generating the leaderboard. Please try again later.');
      }
    }
  }

  private async handleShopCommand(message: Message): Promise<void> {
    try {
      // Define the exact shop message as requested by the user
      const shopMessage = '📊 **Event Avengers Point Shop** 🛒\n\n' +
        '🎯 **Spend Your Points On:**\n\n' +
        '1️⃣ **20 points** – **PvP Match** with **Staff/Owner** <:NeonGhost:1350545929941422182>\n' +
        '2️⃣ **50 points** – **Personalized Emoji** <:ow:1350547781106012320>\n' +
        '3️⃣ **100 points** – **Host a Daily Event**  <:cool_blue_crown:1350546778327482501>\n' +
        '4️⃣ **120 points** – **Talk in VIP Talks** for a week <:coolthonk:1350545587887407214>\n' +
        '5️⃣ **150 points** – **Host a Quick Event** <:sus:1350548483853127863>\n' +
        '6️⃣ **180 points** – **Host a Long Event**<:joinevent_IDS:1347483529923264564> \n' +
        '7️⃣ **200 points** – **Custom Role** <:ve:1351655520322326588> (Exclusive to you!)\n' +
        '8️⃣ **250 points** – **Post Advertisement** in <#1343156919258447892> <:yey:1350789419182854206> \n' +
        '9️⃣ **400 points** – **Custom Displayable Role** <:SkullShock:1347482884197322813> (Exclusive to you!)\n\n' +
        '✨ **Earn points by participating in events or by inviting in server.!** ✨';

      // Send the exact message format requested
      await message.reply(shopMessage);
    } catch (error) {
      console.error('Error displaying shop:', error);
      await message.reply('An error occurred while displaying the shop. Please try again later.');
    }
  }
  
  private async handleAnnounceCommand(message: Message, args: string[], content: string): Promise<void> {
    // Check if user is in admin list
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Extract announcement message (everything after the command)
    const announcementText = content.slice(PREFIX.length).trim().split(/\s+/).slice(1).join(' ');
    
    if (!announcementText) {
      await message.reply('Please provide an announcement message.');
      return;
    }
    
    try {
      // Get all text channels in the guild
      const guild = message.guild;
      if (!guild) {
        await message.reply('This command can only be used in a server.');
        return;
      }
      
      // Confirmation message
      const confirmEmbed = new EmbedBuilder()
        .setTitle('📢 Announcement Broadcasting')
        .setDescription(`I'm sending your announcement to all text channels in the server.`)
        .setColor(THEME.WARNING)
        .addFields({
          name: 'Announcement Text',
          value: announcementText.length > 1024 ? announcementText.substring(0, 1021) + '...' : announcementText
        })
        .setFooter({ text: 'This may take a moment depending on the number of channels.' });
      
      await message.reply({ embeds: [confirmEmbed] });
      
      // Create the announcement embed
      const announcementEmbed = new EmbedBuilder()
        .setTitle('📢 SERVER ANNOUNCEMENT')
        .setDescription(announcementText)
        .setColor(THEME.PRIMARY)
        .setTimestamp()
        .setFooter({ 
          text: `Posted by ${message.author.username}`, 
          iconURL: message.author.displayAvatarURL() 
        });
      
      // Send to all text channels
      let successCount = 0;
      let failCount = 0;
      
      const channels = await guild.channels.fetch();
      const textChannels = channels.filter(channel => 
        channel !== null && 
        channel.type === ChannelType.GuildText && 
        channel.isTextBased() && 
        'send' in channel
      );
      
      for (const [_, channel] of textChannels) {
        if ('send' in channel) {
          try {
            await channel.send({ embeds: [announcementEmbed] });
            successCount++;
          } catch (err) {
            console.error(`Failed to send announcement to channel ${channel.name}:`, err);
            failCount++;
          }
        }
      }
      
      // Send a summary message back to the admin
      const summaryEmbed = new EmbedBuilder()
        .setTitle('📢 Announcement Broadcast Complete')
        .setDescription(`Your announcement has been sent.`)
        .setColor(THEME.SUCCESS)
        .addFields(
          { name: 'Successfully Sent To', value: `${successCount} channels`, inline: true },
          { name: 'Failed To Send To', value: `${failCount} channels`, inline: true }
        );
      
      await message.channel.send({ embeds: [summaryEmbed] });
      
    } catch (error) {
      console.error('Error broadcasting announcement:', error);
      await message.reply('An error occurred while broadcasting the announcement. Please try again later.');
    }
  }
  
  private async handleEarnPointsCommand(message: Message): Promise<void> {
    try {
      // Define the exact earn points message as requested by the user
      const earnPointsMessage = '🎯 **How to Earn Points**\n\n' +
        '🏆 **Event Wins**\n' +
        '- 🎉 **Win a Daily Event** – **+10 points**  \n' +
        '- ⚡ **Win a Quick Event** – **+30 points**  \n' +
        '- ⏳ **Win a Long Event** – **+90 points**\n\n' +
        '📨 **Invites**\n' +
        '- 📩 **Every Valid Invite** – **+4 points**  \n' +
        '  *(The invited member must stay and be active.)*\n\n' +
        '📈 **Leveling**\n' +
        '- 🔟 **Reach 10 Levels** – **+50 points**  \n' +
        '  *(Note: Redeeming this resets your level back to 0)*\n\n' +
        '<:yey:1350789419182854206> **Server Boosting**\n' +
        '- <:ve:1351655520322326588> **Boosting the server once** - **100 points**';

      // Send the exact message format requested
      await message.reply(earnPointsMessage);
    } catch (error) {
      console.error('Error displaying earn points info:', error);
      await message.reply('An error occurred while displaying the earn points information. Please try again later.');
    }
  }
  
  // Track active betting challenges between users
  private activeBets: Map<string, {
    challenger: string;
    challenged: string;
    amount: number;
    timestamp: number;
    // For multi-round betting
    rounds?: Array<{
      player: string;
      choice?: 'heads' | 'tails';
      result?: 'heads' | 'tails';
      winner?: string;
    }>;
    currentRound?: number;
    scores?: {
      [userId: string]: number;
    };
    gameActive?: boolean;
  }> = new Map();

  private async handleBetCommand(message: Message, args: string[]): Promise<void> {
    try {
      // Check if the user has a profile first
      const user = await db.query.users.findFirst({
        where: eq(users.discordId, message.author.id),
      });
      
      if (!user) {
        await message.reply("You don't have a profile yet! Participate in server activities to earn points first.");
        return;
      }
      
      // Get user's current points
      const userPoints = await db.query.points.findFirst({
        where: eq(points.userId, user.id),
      });
      
      if (!userPoints || userPoints.amount <= 0) {
        await message.reply("You don't have any points to bet! Earn some points first before betting.");
        return;
      }
      
      // Check if enough arguments were provided
      if (args.length < 2 || message.mentions.users.size === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🎲 Betting System')
          .setDescription(`Challenge another user to a coin flip for points!`)
          .setColor(THEME.PRIMARY)
          .addFields(
            { name: 'Usage', value: `\`${PREFIX}bet @user <amount>\`` },
            { name: 'Example', value: `\`${PREFIX}bet @Friend 100\`` },
            { name: 'Rules', value: '• Both users must have enough points\n• Challenged user must accept the bet\n• Bets expire after 5 minutes\n• Winner takes all!' }
          )
          .setFooter({ text: 'Gambling responsibly is cool 😎' });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      // Get the mentioned user
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        await message.reply("Please mention a valid user to challenge.");
        return;
      }
      
      // Cannot bet against yourself
      if (targetUser.id === message.author.id) {
        await message.reply("You can't bet against yourself!");
        return;
      }
      
      // Cannot bet against bots
      if (targetUser.bot) {
        await message.reply("You can't bet against bots!");
        return;
      }
      
      // Parse the bet amount
      const betAmount = parseInt(args.find(arg => !arg.startsWith('<@') && !arg.includes('>')) || '0', 10);
      
      if (isNaN(betAmount) || betAmount <= 0) {
        await message.reply("Please provide a valid positive number of points to bet.");
        return;
      }
      
      // Check if user has enough points
      if (userPoints.amount < betAmount) {
        await message.reply(`You don't have enough points for this bet! You have ${userPoints.amount} points.`);
        return;
      }
      
      // Check if target user exists in the database
      const targetUserData = await db.query.users.findFirst({
        where: eq(users.discordId, targetUser.id),
      });
      
      if (!targetUserData) {
        await message.reply(`${targetUser.username} doesn't have a profile yet and can't participate in bets.`);
        return;
      }
      
      // Check if target user has enough points
      const targetUserPoints = await db.query.points.findFirst({
        where: eq(points.userId, targetUserData.id),
      });
      
      if (!targetUserPoints || targetUserPoints.amount < betAmount) {
        await message.reply(`${targetUser.username} doesn't have enough points for this bet!`);
        return;
      }
      
      // Create a unique ID for this bet challenge
      const betId = `${message.author.id}-${targetUser.id}-${Date.now()}`;
      
      // Store the bet in our active bets
      this.activeBets.set(betId, {
        challenger: message.author.id,
        challenged: targetUser.id,
        amount: betAmount,
        timestamp: Date.now(),
        // Initialize the multi-round betting structure
        rounds: [
          { player: message.author.id },
          { player: targetUser.id },
          { player: message.author.id },
          { player: targetUser.id }
        ],
        currentRound: 0,
        scores: {
          [message.author.id]: 0,
          [targetUser.id]: 0
        },
        gameActive: false
      });
      
      // Create buttons for accepting and declining the bet
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`accept_${betId}`)
            .setLabel('ACCEPT BET')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`decline_${betId}`)
            .setLabel('DECLINE BET')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        );
      
      // Create an embed to display the bet challenge
      const betEmbed = new EmbedBuilder()
        .setTitle('🎲 Bet Challenge!')
        .setDescription(`**${message.author.username}** has challenged **${targetUser.username}** to a best-of-4 coin flip game!`)
        .setColor(THEME.PRIMARY)
        .addFields(
          { name: 'Bet Amount', value: `${betAmount.toLocaleString()} points`, inline: true },
          { name: '🎮 Game Format', value: 'Best of 4 rounds of coin flips', inline: true },
          { name: '⏰ Time Limit', value: 'This bet will expire in 5 minutes if not accepted.' }
        )
        .setFooter({ text: 'May the odds be ever in your favor!' });
      
      // Send the message with both the embed and buttons
      const sentMessage = await message.reply({ 
        content: `<@${targetUser.id}>, you've been challenged to a bet!`,
        embeds: [betEmbed],
        components: [row]
      });
      
      // Create a collector for the button interactions
      const filter = (i: ButtonInteraction) => {
        // Only the challenged user can respond to the bet
        return i.user.id === targetUser.id && 
               (i.customId === `accept_${betId}` || i.customId === `decline_${betId}`);
      };
      
      const collector = sentMessage.createMessageComponentCollector({ 
        filter, 
        time: 300000, // 5 minutes
        componentType: ComponentType.Button,
        max: 1 
      });
      
      collector.on('collect', async (interaction: ButtonInteraction) => {
        if (interaction.customId === `accept_${betId}`) {
          // The user clicked the ACCEPT button
          // First acknowledge the interaction
          await interaction.deferUpdate();
          
          try {
            // Check if the bet still exists
            const bet = this.activeBets.get(betId);
            if (!bet) {
              await interaction.followUp({
                content: 'This bet is no longer active.',
                ephemeral: true
              });
              return;
            }
            
            // Get challenger's points
            const challengerUser = await db.query.users.findFirst({
              where: eq(users.discordId, message.author.id),
            });
            
            if (!challengerUser) {
              await interaction.followUp({
                content: "The challenger doesn't have a profile in the system.",
                ephemeral: true
              });
              this.activeBets.delete(betId);
              return;
            }
            
            const challengerPoints = await db.query.points.findFirst({
              where: eq(points.userId, challengerUser.id),
            });
            
            if (!challengerPoints || challengerPoints.amount < bet.amount) {
              await interaction.followUp({
                content: "The challenger doesn't have enough points for this bet anymore.",
                ephemeral: true
              });
              this.activeBets.delete(betId);
              return;
            }
            
            // Get challenged user's points
            const challengedUser = await db.query.users.findFirst({
              where: eq(users.discordId, targetUser.id),
            });
            
            if (!challengedUser) {
              await interaction.followUp({
                content: "You don't have a profile in the system yet.",
                ephemeral: true
              });
              this.activeBets.delete(betId);
              return;
            }
            
            const challengedPoints = await db.query.points.findFirst({
              where: eq(points.userId, challengedUser.id),
            });
            
            if (!challengedPoints || challengedPoints.amount < bet.amount) {
              await interaction.followUp({
                content: "You don't have enough points for this bet.",
                ephemeral: true
              });
              this.activeBets.delete(betId);
              return;
            }
            
            // Activate the game
            bet.gameActive = true;
            
            // Ensure rounds are properly initialized
            if (!bet.rounds || !Array.isArray(bet.rounds) || bet.rounds.length !== 4) {
              bet.rounds = [
                { player: message.author.id },
                { player: targetUser.id },
                { player: message.author.id },
                { player: targetUser.id }
              ];
            }
            
            // Ensure scores are initialized
            if (!bet.scores) {
              bet.scores = {
                [message.author.id]: 0,
                [targetUser.id]: 0
              };
            }
            
            // Explicitly set current round to 0
            bet.currentRound = 0;
            
            // Update message to show bet is accepted
            const acceptedEmbed = new EmbedBuilder()
              .setTitle('🎲 Bet Accepted!')
              .setDescription(`**${targetUser.username}** has accepted **${message.author.username}'s** bet of **${bet.amount.toLocaleString()}** points!`)
              .setColor(THEME.SUCCESS)
              .addFields(
                { name: '🎮 Game Format', value: 'Best of 4 rounds of coin flips' }
              );
            
            await sentMessage.edit({ 
              content: `Bet accepted! Game starting...`,
              embeds: [acceptedEmbed], 
              components: [] // Remove the buttons
            });
            
            // Start the game after a short delay
            setTimeout(() => {
              // Get the challenger and challenged users
              this.client.users.fetch(message.author.id).then(challenger => {
                // Start the coin flip game
                if (interaction.channel && interaction.channel.type === ChannelType.GuildText) {
                  this.handleCoinFlipChoice(
                    interaction.channel, 
                    bet, 
                    betId, 
                    challenger, 
                    targetUser, 
                    challengerPoints, 
                    challengedPoints
                  );
                }
              }).catch(error => {
                console.error('Error fetching challenger user:', error);
              });
            }, 1500);
            
          } catch (error) {
            console.error('Error handling accept bet interaction:', error);
            await interaction.followUp({
              content: 'An error occurred while accepting the bet. Please try again later.',
              ephemeral: true
            });
          }
        } 
        else if (interaction.customId === `decline_${betId}`) {
          // The user clicked the DECLINE button
          // First acknowledge the interaction
          await interaction.deferUpdate();
          
          try {
            // Check if the bet still exists
            const bet = this.activeBets.get(betId);
            if (!bet) {
              await interaction.followUp({
                content: 'This bet is no longer active.',
                ephemeral: true
              });
              return;
            }
            
            // Create decline embed
            const declineEmbed = new EmbedBuilder()
              .setTitle('🎲 Bet Declined')
              .setDescription(`**${targetUser.username}** has declined **${message.author.username}'s** bet of **${bet.amount.toLocaleString()}** points.`)
              .setColor(THEME.ERROR)
              .setFooter({ text: 'No points were exchanged.' });
            
            // Update the message with the decline embed
            await sentMessage.edit({ 
              content: `Bet declined by ${targetUser.username}`,
              embeds: [declineEmbed], 
              components: [] // Remove the buttons
            });
            
            // Remove the bet from active bets
            this.activeBets.delete(betId);
            
          } catch (error) {
            console.error('Error handling decline bet interaction:', error);
            await interaction.followUp({
              content: 'An error occurred while declining the bet. Please try again later.',
              ephemeral: true
            });
          }
        }
      });
      
      collector.on('end', async (collected) => {
        if (collected.size === 0) {
          // No one responded in time
          const timeoutEmbed = new EmbedBuilder()
            .setTitle('⏰ Bet Expired')
            .setDescription(`The bet challenge from **${message.author.username}** to **${targetUser.username}** has expired.`)
            .setColor(THEME.WARNING)
            .setFooter({ text: 'No points were exchanged.' });
          
          await sentMessage.edit({ 
            content: 'This bet has expired',
            embeds: [timeoutEmbed], 
            components: [] // Remove the buttons
          });
          
          // Remove the bet from active bets
          this.activeBets.delete(betId);
        }
      });
      
    } catch (error) {
      console.error('Error handling bet command:', error);
      await message.reply('An error occurred while processing your bet. Please try again later.');
    }
  }

  private async handleMessageCommand(message: Message, args: string[], fullContent: string): Promise<void> {
    try {
      // Check if user is in admin list
      if (!ADMIN_IDS.includes(message.author.id)) {
        await message.reply('You do not have permission to use this command.');
        return;
      }
      
      // Extract the custom message content (everything after the command)
      let customMessage = '';
      
      // Handle both forms: !msg <content> and !message <content>
      if (fullContent.startsWith(`${PREFIX}msg `)) {
        customMessage = fullContent.substring(`${PREFIX}msg `.length);
      } else if (fullContent.startsWith(`${PREFIX}message `)) {
        customMessage = fullContent.substring(`${PREFIX}message `.length);
      }
      
      if (!customMessage) {
        await message.reply(`Please provide a message after the command. Example: \`${PREFIX}msg Hello everyone!\``);
        return;
      }
      
      // Create a new message as the bot
      await (message.channel as TextChannel).send({
        content: customMessage,
        allowedMentions: { parse: [] } // Prevents the bot from pinging anyone mentioned in the message
      }).catch((err: Error) => {
        console.error('Error sending custom message:', err);
        message.reply('Failed to send the message. I might not have permission to send messages in this channel.');
      });
      
      // Delete the original command message to make it appear as if the bot said it directly
      try {
        await message.delete();
      } catch (deleteError) {
        console.error('Error deleting original command message:', deleteError);
        // Continue even if delete fails (might not have proper permissions)
      }
    } catch (error) {
      console.error('Error handling message command:', error);
      await message.reply('An error occurred while processing the message command.');
    }
  }

  public async login(): Promise<void> {
    if (!this.token) {
      console.error('Discord bot token not found. Please set the DISCORD_BOT_TOKEN environment variable.');
      return;
    }

    try {
      await this.client.login(this.token);
    } catch (error) {
      console.error('Failed to login to Discord:', error);
      this.status.connection.status = 'offline';
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        this.status.connection.status = 'reconnecting';
        this.status.autoReconnect.lastReconnection = new Date().toISOString();
        this.login();
      }, 5000);
    }
  }
  
  public isConnected(): boolean {
    return this.client && this.client.isReady();
  }

  public getStatus() {
    // Calculate uptime
    let uptimeStr = 'N/A';
    if (this.status.connection.startTime) {
      const uptime = Date.now() - this.status.connection.startTime.getTime();
      const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
      const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
      
      uptimeStr = `${days} days, ${hours} hours, ${minutes} minutes`;
    }

    return {
      connection: {
        status: this.status.connection.status,
        uptime: uptimeStr,
      },
      database: {
        status: this.status.database.status,
        lastSync: this.status.database.lastSync,
      },
      autoReconnect: {
        enabled: this.status.autoReconnect.enabled,
        lastReconnection: this.status.autoReconnect.lastReconnection,
      },
    };
  }

  // Note: handleAcceptBetCommand was replaced with button functionality
  
  private async handleCoinFlipChoice(channel: TextChannel, bet: any, betId: string, challenger: User, challenged: User, challengerPoints: any, challengedPoints: any): Promise<void> {
    try {
      // Set current round
      if (bet.currentRound === undefined || bet.currentRound === null) {
        bet.currentRound = 0;
      }
      
      // Ensure rounds are properly initialized
      if (!bet.rounds || !Array.isArray(bet.rounds) || bet.rounds.length !== 4) {
        bet.rounds = [
          { player: challenger.id },
          { player: challenged.id },
          { player: challenger.id },
          { player: challenged.id }
        ];
      }
      
      // Ensure scores are initialized
      if (!bet.scores) {
        bet.scores = {
          [challenger.id]: 0,
          [challenged.id]: 0
        };
      }
      
      // Get current player
      const currentRound = bet.rounds[bet.currentRound];
      const currentPlayerId = currentRound.player;
      const currentPlayer = currentPlayerId === challenger.id ? challenger : challenged;
      const currentPlayerName = currentPlayer.username;
      
      // Create buttons for heads and tails
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`${betId}_heads`)
            .setLabel('HEADS')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🪙'),
          new ButtonBuilder()
            .setCustomId(`${betId}_tails`)
            .setLabel('TAILS')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🪙')
        );
      
      // Create a prompt message with buttons
      const promptEmbed = new EmbedBuilder()
        .setTitle(`🎲 Round ${bet.currentRound + 1} of 4`)
        .setDescription(`**${currentPlayerName}**, it's your turn! Choose heads or tails by clicking a button below.`)
        .setColor(THEME.INFO)
        .addFields(
          { name: '💰 Bet Amount', value: `${bet.amount.toLocaleString()} points`, inline: true },
          { name: '📊 Current Score', value: `${challenger.username}: ${bet.scores[challenger.id]} | ${challenged.username}: ${bet.scores[challenged.id]}`, inline: true }
        )
        .setThumbnail(currentPlayer.displayAvatarURL());
      
      const promptMessage = await channel.send({ 
        content: `<@${currentPlayerId}>, your turn to choose!`,
        embeds: [promptEmbed],
        components: [row]
      });
      
      // Create a collector for button interactions
      const filter = (i: ButtonInteraction) => {
        return i.user.id === currentPlayerId && i.customId.startsWith(`${betId}_`);
      };
      
      const collector = promptMessage.createMessageComponentCollector({ 
        filter,
        componentType: ComponentType.Button,
        time: 60000,
        max: 1
      });
      
      collector.on('collect', async (interaction: ButtonInteraction) => {
        // Extract the player's choice from the button
        const choice = interaction.customId.includes('heads') ? 'heads' : 'tails';
        
        // Update the bet with the player's choice
        bet.rounds[bet.currentRound].choice = choice;
        
        // First acknowledge the interaction
        await interaction.deferUpdate();
        
        // Flip the coin (50/50 chance)
        const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
        bet.rounds[bet.currentRound].result = coinResult;
        
        // Determine if player won this round
        const roundWin = choice === coinResult;
        if (roundWin) {
          bet.scores[currentPlayerId]++;
          bet.rounds[bet.currentRound].winner = currentPlayerId;
        }
        
        // Create a result embed for this round
        const resultEmbed = new EmbedBuilder()
          .setTitle(`🎲 Round ${bet.currentRound + 1} Result`)
          .setDescription(`**${currentPlayerName}** chose **${choice}** and the coin landed on **${coinResult}**!`)
          .setColor(roundWin ? THEME.SUCCESS : THEME.ERROR)
          .addFields(
            { name: '📊 Current Score', value: `${challenger.username}: ${bet.scores[challenger.id]} | ${challenged.username}: ${bet.scores[challenged.id]}`, inline: false }
          )
          .setImage(coinResult === 'heads' 
            ? 'https://cdn-icons-png.flaticon.com/512/272/272525.png' // Simple heads coin image
            : 'https://cdn-icons-png.flaticon.com/512/272/272497.png'); // Simple tails coin image
        
        await promptMessage.edit({ 
          content: `Round ${bet.currentRound + 1} result:`,
          embeds: [resultEmbed], 
          components: [] // Remove the buttons
        });
        
        // Wait a moment before proceeding to next round
        setTimeout(async () => {
          // Increment round counter
          bet.currentRound++;
          
          // Check if the game is over
          if (bet.currentRound >= bet.rounds.length) {
            // Game is over, determine the winner
            await this.finalizeBetGame(channel, bet, betId, challenger, challenged, challengerPoints, challengedPoints);
          } else {
            // Continue to next round
            await this.handleCoinFlipChoice(channel, bet, betId, challenger, challenged, challengerPoints, challengedPoints);
          }
        }, 3000);
      });
      
      collector.on('end', async (collected) => {
        if (collected.size === 0) {
          // Player didn't respond in time
          const timeoutEmbed = new EmbedBuilder()
            .setTitle('⏰ Time\'s Up!')
            .setDescription(`**${currentPlayerName}** didn't make a choice in time! The bet is cancelled.`)
            .setColor(THEME.ERROR)
            .setFooter({ text: 'No points were exchanged.' });
          
          await promptMessage.edit({ 
            content: 'Bet cancelled due to timeout:',
            embeds: [timeoutEmbed], 
            components: [] // Remove the buttons
          });
          
          this.activeBets.delete(betId);
        }
      });
      
    } catch (error) {
      console.error('Error handling coin flip choice:', error);
      await channel.send('An error occurred during the coin flip game. The bet has been cancelled.');
      this.activeBets.delete(betId);
    }
  }
  
  private async finalizeBetGame(channel: TextChannel, bet: any, betId: string, challenger: User, challenged: User, challengerPoints: any, challengedPoints: any): Promise<void> {
    try {
      // Determine the winner
      const challengerScore = bet.scores[challenger.id];
      const challengedScore = bet.scores[challenged.id];
      
      let winner: User, loser: User;
      let winnerPoints: any, loserPoints: any;
      
      if (challengerScore > challengedScore) {
        winner = challenger;
        loser = challenged;
        winnerPoints = challengerPoints;
        loserPoints = challengedPoints;
      } else if (challengedScore > challengerScore) {
        winner = challenged;
        loser = challenger;
        winnerPoints = challengedPoints;
        loserPoints = challengerPoints;
      } else {
        // It's a tie! No points exchanged
        const tieEmbed = new EmbedBuilder()
          .setTitle('🎲 Game Ended in a Tie!')
          .setDescription(`The coin flip game between **${challenger.username}** and **${challenged.username}** ended in a tie with ${challengerScore}-${challengedScore}!`)
          .setColor(THEME.WARNING)
          .addFields(
            { name: '📊 Final Score', value: `${challenger.username}: ${challengerScore} | ${challenged.username}: ${challengedScore}`, inline: false },
            { name: '💰 Result', value: 'Since it was a tie, no points were exchanged.', inline: false }
          )
          .setFooter({ text: 'Thanks for playing!' });
        
        await channel.send({ embeds: [tieEmbed] });
        this.activeBets.delete(betId);
        return;
      }
      
      // Update points in database
      await db.update(points)
        .set({ 
          amount: winnerPoints.amount + bet.amount,
          updatedAt: new Date(),
        })
        .where(eq(points.id, winnerPoints.id));
      
      await db.update(points)
        .set({ 
          amount: loserPoints.amount - bet.amount,
          updatedAt: new Date(),
        })
        .where(eq(points.id, loserPoints.id));
      
      // Create the final results embed
      const finalEmbed = new EmbedBuilder()
        .setTitle(`🎉 ${winner.username} Wins the Bet!`)
        .setDescription(`**${winner.username}** won the coin flip game against **${loser.username}** with a score of ${bet.scores[winner.id]}-${bet.scores[loser.id]} and earned **${bet.amount.toLocaleString()}** points!`)
        .setColor(THEME.SUCCESS)
        .addFields(
          { name: '📊 Final Score', value: `${challenger.username}: ${challengerScore} | ${challenged.username}: ${challengedScore}`, inline: false },
          { name: '🏆 Winner', value: `${winner.username} (now has ${(winnerPoints.amount + bet.amount).toLocaleString()} points)`, inline: false },
          { name: '😢 Loser', value: `${loser.username} (now has ${(loserPoints.amount - bet.amount).toLocaleString()} points)`, inline: false }
        )
        .setThumbnail(winner.displayAvatarURL())
        .setFooter({ text: 'Thanks for playing! Challenge again?' });
      
      await channel.send({ embeds: [finalEmbed] });
      
      // Remove the bet from active bets
      this.activeBets.delete(betId);
      
    } catch (error) {
      console.error('Error finalizing bet game:', error);
      await channel.send('An error occurred while finalizing the bet. Please contact an administrator.');
      this.activeBets.delete(betId);
    }
  }
  
  // Note: handleChoiceCommand was replaced with button functionality
  
  // Note: handleDeclineBetCommand was replaced with button functionality

  // Helper function to parse date string in various formats
  private parseDate(dateStr: string, nextArg?: string): Date | null {
    // Try standard MM/DD/YYYY format
    const dateRegex1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    // Try YYYY-MM-DD format
    const dateRegex2 = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    // Try relative time format (e.g., 30min, 2hours, 1day)
    const relativeTimeRegex = /^(\d+)\s*(m(in(ute)?s?)?|h(ou)?rs?|d(ay)?s?|w(ee)?ks?)$/i;
    // Try number only format (e.g., "30" with next arg as "mins")
    const numberOnlyRegex = /^(\d+)$/;
    // Time unit regex for checking next argument
    const timeUnitRegex = /^(m(in(ute)?s?)?|h(ou)?rs?|d(ay)?s?|w(ee)?ks?)$/i;
    
    let parsedDate: Date | null = null;
    
    if (dateRegex1.test(dateStr)) {
      const match = dateStr.match(dateRegex1);
      if (match) {
        const month = parseInt(match[1]) - 1; // Months are 0-indexed in JS Date
        const day = parseInt(match[2]);
        const year = parseInt(match[3]);
        parsedDate = new Date(year, month, day);
      }
    } else if (dateRegex2.test(dateStr)) {
      const match = dateStr.match(dateRegex2);
      if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // Months are 0-indexed in JS Date
        const day = parseInt(match[3]);
        parsedDate = new Date(year, month, day);
      }
    } else if (relativeTimeRegex.test(dateStr)) {
      // Parse relative time format like "30mins"
      const match = dateStr.match(relativeTimeRegex);
      if (match) {
        const amount = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        const now = new Date();
        
        if (unit.startsWith('m')) {
          // Minutes
          parsedDate = new Date(now.getTime() + (amount * 60 * 1000));
        } else if (unit.startsWith('h')) {
          // Hours
          parsedDate = new Date(now.getTime() + (amount * 60 * 60 * 1000));
        } else if (unit.startsWith('d')) {
          // Days
          parsedDate = new Date(now.getTime() + (amount * 24 * 60 * 60 * 1000));
        } else if (unit.startsWith('w')) {
          // Weeks
          parsedDate = new Date(now.getTime() + (amount * 7 * 24 * 60 * 60 * 1000));
        }
      }
    } else if (numberOnlyRegex.test(dateStr) && nextArg && timeUnitRegex.test(nextArg)) {
      // Handle "30 mins" as two separate arguments
      const amount = parseInt(dateStr);
      const unit = nextArg.toLowerCase();
      
      const now = new Date();
      
      if (unit.startsWith('m')) {
        // Minutes
        parsedDate = new Date(now.getTime() + (amount * 60 * 1000));
      } else if (unit.startsWith('h')) {
        // Hours
        parsedDate = new Date(now.getTime() + (amount * 60 * 60 * 1000));
      } else if (unit.startsWith('d')) {
        // Days
        parsedDate = new Date(now.getTime() + (amount * 24 * 60 * 60 * 1000));
      } else if (unit.startsWith('w')) {
        // Weeks
        parsedDate = new Date(now.getTime() + (amount * 7 * 24 * 60 * 60 * 1000));
      }
    } else {
      // Try general parsing if the format doesn't match
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        parsedDate = date;
      }
    }
    
    return parsedDate;
  }
  
  // Helper to get remaining time in a human-readable format
  private getRemainingTime(targetDate: Date): string {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();
    
    // If the date is in the past
    if (diff <= 0) {
      return "Event has already started!";
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    
    return parts.join(', ');
  }
  
  // Create a countdown with fancy embed
  private async handleCountdownCommand(message: Message, args: string[]): Promise<void> {
    // Check if user is admin
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command. Only admins can create countdowns.');
      return;
    }
    
    if (args.length < 2) {
      const embed = new EmbedBuilder()
        .setTitle('⏱️ Countdown Command Usage')
        .setDescription(`\`${PREFIX}countdown "Event Name" DATE_OR_TIME [description]\``)
        .setColor(THEME.PRIMARY)
        .addFields(
          { name: 'Full Date Example', value: `\`${PREFIX}countdown "Summer Party" 06/15/2024 Join us for our awesome summer event!\`` },
          { name: 'Relative Time Example', value: `\`${PREFIX}countdown "Team Meeting" 30 mins Quick sync-up call\`\n\`${PREFIX}countdown "Movie Night" 2 hours Get your popcorn ready!\`` },
          { name: 'Supported Date Formats', value: 'MM/DD/YYYY format (06/15/2024)\nYYYY-MM-DD format (2024-06-15)' },
          { name: 'Supported Time Units', value: 'mins/minutes, hrs/hours, days, weeks' },
          { name: 'Description', value: 'Optional but helps users understand what the event is about' }
        )
        .setFooter({ text: 'Event names with spaces must be in quotes' });
      
      await message.reply({ embeds: [embed] });
      return;
    }
    
    try {
      // Extract event name (may be in quotes)
      let eventName = "";
      let dateStr = "";
      let description = "";
      
      // Check if first argument is quoted
      if (args[0].startsWith('"')) {
        // Find the closing quote
        const fullContent = message.content.slice(PREFIX.length + 'countdown'.length).trim();
        const nameMatch = fullContent.match(/"([^"]+)"/);
        
        if (nameMatch) {
          eventName = nameMatch[1];
          
          // Remove the event name (with quotes) from args
          const remainingContent = fullContent.slice(nameMatch[0].length).trim();
          const remainingArgs = remainingContent.split(/\s+/);
          
          // Get date string (first arg after event name)
          dateStr = remainingArgs[0];
          
          // Get description (everything else)
          description = remainingArgs.slice(1).join(' ');
        } else {
          eventName = args[0].replace(/"/g, '');
          dateStr = args[1];
          description = args.slice(2).join(' ');
        }
      } else {
        // No quotes, assume event name is a single word
        eventName = args[0];
        dateStr = args[1];
        description = args.slice(2).join(' ');
      }
      
      // Parse the date - first try to parse it as a standalone value
      let targetDate = this.parseDate(dateStr);
      
      // If that fails and we have a description, check if the first part of the description is a time unit
      if (!targetDate && description) {
        const descriptionParts = description.split(/\s+/);
        if (descriptionParts.length > 0) {
          // Try to parse as "30 mins" format (two separate arguments)
          targetDate = this.parseDate(dateStr, descriptionParts[0]);
          
          // If successful, remove the time unit from the description
          if (targetDate) {
            description = descriptionParts.slice(1).join(' ');
          }
        }
      }
      
      if (!targetDate) {
        await message.reply('Please provide a valid date format (MM/DD/YYYY) or relative time (30 mins, 2 hours, 1 day, etc.).');
        return;
      }
      
      // Check if date is in the future
      if (targetDate.getTime() <= Date.now()) {
        await message.reply('The countdown date must be in the future.');
        return;
      }
      
      // Create the countdown embed
      const embed = new EmbedBuilder()
        .setTitle(`⏱️ Event Countdown: ${eventName}`)
        .setDescription(`${description ? description + "\n\n" : ""}**Time remaining:** ${this.getRemainingTime(targetDate)}`)
        .setColor(THEME.PRIMARY)
        .addFields(
          { name: 'Event Date', value: `<t:${Math.floor(targetDate.getTime() / 1000)}:F>`, inline: true },
          { name: 'Relative Time', value: `<t:${Math.floor(targetDate.getTime() / 1000)}:R>`, inline: true },
        )
        .setFooter({ text: `Countdown created by ${message.author.username}` })
        .setTimestamp();
      
      // Check if this message is in a guild text channel
      if (!message.guild || !message.channel.isTextBased()) {
        await message.reply('Can only create countdowns in server text channels.');
        return;
      }
      
      const textChannel = message.channel as TextChannel;
      // Send the countdown embed
      const sentMessage = await textChannel.send({ embeds: [embed] });
      
      // Store in database
      await db.insert(countdowns).values({
        eventName: eventName,
        description: description || null,
        channelId: message.channel.id,
        messageId: sentMessage.id,
        creatorId: message.author.id,
        targetDate: targetDate,
        embedColor: THEME.PRIMARY,
        isActive: true,
      });
      
      // Success message
      await message.reply(`✅ Countdown for "${eventName}" has been created successfully!`);
      
    } catch (error) {
      console.error('Error creating countdown:', error);
      await message.reply('An error occurred while creating the countdown. Please try again.');
    }
  }
  
  // List all active countdowns
  private async handleListCountdownsCommand(message: Message): Promise<void> {
    try {
      // Get all active countdowns
      const activeCountdowns = await db.query.countdowns.findMany({
        where: eq(countdowns.isActive, true),
        orderBy: (countdowns, { asc }) => [asc(countdowns.targetDate)],
      });
      
      if (activeCountdowns.length === 0) {
        await message.reply('There are no active countdowns at the moment.');
        return;
      }
      
      // Create the embed
      const embed = new EmbedBuilder()
        .setTitle('📅 Active Event Countdowns')
        .setColor(THEME.INFO)
        .setDescription('Here are all the upcoming events:');
      
      // Add each countdown as a field
      activeCountdowns.forEach(countdown => {
        const targetDate = new Date(countdown.targetDate);
        const timeRemaining = this.getRemainingTime(targetDate);
        
        embed.addFields({
          name: `#${countdown.id}: ${countdown.eventName}`,
          value: `**Time remaining:** ${timeRemaining}\n**Date:** <t:${Math.floor(targetDate.getTime() / 1000)}:F>\n${countdown.description ? `**Description:** ${countdown.description}` : ''}`,
        });
      });
      
      embed.setFooter({ text: `Total countdowns: ${activeCountdowns.length}` });
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error listing countdowns:', error);
      await message.reply('An error occurred while fetching countdowns. Please try again.');
    }
  }
  
  // Delete a countdown by ID
  private async handleDeleteCountdownCommand(message: Message, args: string[]): Promise<void> {
    // Check if user is admin
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command. Only admins can delete countdowns.');
      return;
    }
    
    if (args.length < 1) {
      await message.reply(`Please specify the ID of the countdown to delete. Use \`${PREFIX}countdowns\` to see all active countdowns with their IDs.`);
      return;
    }
    
    const countdownId = parseInt(args[0]);
    
    if (isNaN(countdownId)) {
      await message.reply('Please provide a valid countdown ID (number).');
      return;
    }
    
    try {
      // Find the countdown
      const countdown = await db.query.countdowns.findFirst({
        where: eq(countdowns.id, countdownId),
      });
      
      if (!countdown) {
        await message.reply(`No countdown found with ID ${countdownId}. Use \`${PREFIX}countdowns\` to see all active countdowns.`);
        return;
      }
      
      // Mark as inactive instead of deleting
      await db.update(countdowns)
        .set({ isActive: false })
        .where(eq(countdowns.id, countdownId));
      
      // Try to delete the original countdown message
      if (countdown.channelId && countdown.messageId) {
        try {
          const channel = await this.client.channels.fetch(countdown.channelId);
          if (channel && channel.isTextBased()) {
            const message = await (channel as TextChannel).messages.fetch(countdown.messageId);
            if (message) {
              await message.delete();
            }
          }
        } catch (error) {
          console.log('Could not delete original countdown message:', error);
          // Continue anyway as this is not critical
        }
      }
      
      await message.reply(`✅ Countdown "${countdown.eventName}" has been deleted successfully.`);
    } catch (error) {
      console.error('Error deleting countdown:', error);
      await message.reply('An error occurred while deleting the countdown. Please try again.');
    }
  }
  
  // Update countdowns periodically (can be called on a schedule)
  public async updateCountdowns(): Promise<void> {
    try {
      // Get all active countdowns
      const activeCountdowns = await db.query.countdowns.findMany({
        where: eq(countdowns.isActive, true),
      });
      
      for (const countdown of activeCountdowns) {
        const targetDate = new Date(countdown.targetDate);
        
        // Skip if the countdown has already passed
        if (targetDate.getTime() <= Date.now()) {
          // Mark as inactive
          await db.update(countdowns)
            .set({ isActive: false })
            .where(eq(countdowns.id, countdown.id));
          continue;
        }
        
        // Try to update the message
        if (countdown.channelId && countdown.messageId) {
          try {
            const channel = await this.client.channels.fetch(countdown.channelId);
            if (channel && channel.isTextBased()) {
              const message = await (channel as TextChannel).messages.fetch(countdown.messageId);
              if (message) {
                const embed = new EmbedBuilder()
                  .setTitle(`⏱️ Event Countdown: ${countdown.eventName}`)
                  .setDescription(`${countdown.description ? countdown.description + "\n\n" : ""}**Time remaining:** ${this.getRemainingTime(targetDate)}`)
                  .setColor(countdown.embedColor as number)
                  .addFields(
                    { name: 'Event Date', value: `<t:${Math.floor(targetDate.getTime() / 1000)}:F>`, inline: true },
                    { name: 'Relative Time', value: `<t:${Math.floor(targetDate.getTime() / 1000)}:R>`, inline: true },
                  )
                  .setFooter({ text: `Countdown created by ${(await this.client.users.fetch(countdown.creatorId)).username}` })
                  .setTimestamp();
                
                await message.edit({ embeds: [embed] });
              }
            }
          } catch (error) {
            console.error(`Error updating countdown ${countdown.id}:`, error);
            // Continue with other countdowns
          }
        }
      }
    } catch (error) {
      console.error('Error updating countdowns:', error);
    }
  }

  public async getLeaderboard() {
    try {
      // Get top 10 users by points
      const leaderboardData = await db.query.points.findMany({
        orderBy: (points, { desc }) => [desc(points.amount)],
        limit: 10,
        with: {
          user: true,
        },
      });

      if (leaderboardData.length === 0) {
        return { users: [] };
      }

      const users = leaderboardData.map((entry, index) => {
        return {
          id: entry.user.id,
          username: entry.user.username,
          points: entry.amount,
          rank: index + 1,
          avatarUrl: entry.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.user.username)}&background=random`,
        };
      });

      return { users };
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      throw error;
    }
  }
  
  // =================================================
  // Giveaway Commands
  // =================================================
  
  private async handleGiveawayCommand(message: Message, args: string[]): Promise<void> {
    // Check if args array is empty
    if (!args || args.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('🎁 Giveaway Command')
        .setColor(THEME.INFO)
        .setDescription('Use the following subcommands to manage giveaways:')
        .addFields(
          { 
            name: 'Admin Commands',
            value: 
              `\`${PREFIX}giveaway create "Prize Name" <duration>\` - Create a new giveaway\n` +
              `\`${PREFIX}giveaway end <id>\` - End a giveaway and pick winners\n` +
              `\`${PREFIX}giveaway cancel <id>\` - Cancel an active giveaway`
          },
          {
            name: 'User Commands',
            value: `\`${PREFIX}giveaways\` - View all active giveaways`
          }
        )
        .setFooter({ text: '✧✦✧ Giveaways can only be managed by server admins ✧✦✧' });
      
      await message.reply({ embeds: [embed] });
      return;
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'create':
        // Admin-only command
        if (!ADMIN_IDS.includes(message.author.id)) {
          await message.reply('You do not have permission to create giveaways.');
          return;
        }
        
        await this.handleCreateGiveaway(message, args.slice(1));
        break;
        
      case 'end':
        // Admin-only command
        if (!ADMIN_IDS.includes(message.author.id)) {
          await message.reply('You do not have permission to end giveaways.');
          return;
        }
        
        if (args.length < 2) {
          await message.reply(`Please provide a giveaway ID. Usage: \`${PREFIX}giveaway end <id>\``);
          return;
        }
        
        const endId = parseInt(args[1], 10);
        if (isNaN(endId)) {
          await message.reply('Please provide a valid giveaway ID (number).');
          return;
        }
        
        await this.handleEndGiveaway(message, endId);
        break;
        
      case 'cancel':
        // Admin-only command
        if (!ADMIN_IDS.includes(message.author.id)) {
          await message.reply('You do not have permission to cancel giveaways.');
          return;
        }
        
        if (args.length < 2) {
          await message.reply(`Please provide a giveaway ID. Usage: \`${PREFIX}giveaway cancel <id>\``);
          return;
        }
        
        const cancelId = parseInt(args[1], 10);
        if (isNaN(cancelId)) {
          await message.reply('Please provide a valid giveaway ID (number).');
          return;
        }
        
        await this.handleCancelGiveaway(message, cancelId);
        break;
        
      default:
        await message.reply(`Unknown giveaway subcommand. Use \`${PREFIX}giveaway\` to see available commands.`);
    }
  }
  
  private async handleCreateGiveaway(message: Message, args: string[]): Promise<void> {
    try {
      // Expected format: ["Prize Name", "duration"]
      // Extract prize name (which might be in quotes)
      let prizeName = '';
      let duration = '';
      
      // Handle prize name in quotes
      const fullContent = args.join(' ');
      const quoteMatch = fullContent.match(/"([^"]+)"/);
      
      if (quoteMatch) {
        prizeName = quoteMatch[1]; // The content inside quotes
        
        // Get the duration from the text after the quoted prize name
        const afterQuote = fullContent.substring(fullContent.indexOf(quoteMatch[0]) + quoteMatch[0].length).trim();
        duration = afterQuote;
      } else {
        // If no quotes, try to parse the input differently
        if (args.length < 2) {
          await message.reply(`Please provide both a prize name and duration. Usage: \`${PREFIX}giveaway create "Prize Name" <duration>\``);
          return;
        }
        
        prizeName = args[0];
        duration = args[1];
      }
      
      if (!prizeName || !duration) {
        await message.reply(`Please provide both a prize name and duration. Usage: \`${PREFIX}giveaway create "Prize Name" <duration>\``);
        return;
      }
      
      // Parse duration (e.g., "1h", "30m", "1d", etc.)
      const durationInMs = this.parseDuration(duration);
      if (durationInMs <= 0) {
        await message.reply('Please provide a valid duration (e.g., 1h, 30m, 1d).');
        return;
      }
      
      const endDate = new Date(Date.now() + durationInMs);
      
      // Create the giveaway in the database
      const [giveaway] = await db.insert(giveaways)
        .values({
          name: prizeName,
          creatorId: message.author.id,
          channelId: message.channel.id,
          endTime: endDate,
          status: 'active',
          winnerCount: 1, // Default to 1 winner
        })
        .returning();
      
      // Create embed with buttons to enter
      const embed = new EmbedBuilder()
        .setTitle('🎁 New Giveaway!')
        .setColor(THEME.SUCCESS)
        .setDescription(`**${prizeName}**`)
        .addFields(
          { name: '🕒 Ends In', value: `<t:${Math.floor(endDate.getTime() / 1000)}:R>`, inline: true },
          { name: '🏆 Winners', value: '1', inline: true },
          { name: '👥 Entries', value: '0', inline: true },
          { name: 'ID', value: `${giveaway.id}`, inline: true }
        )
        .setFooter({ text: `Created by ${message.author.username} • Click the button below to enter!` });
      
      // Create button for entering
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_enter_${giveaway.id}`)
            .setLabel('Enter Giveaway')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎁')
        );
      
      // Make sure we're in a text channel that supports sending messages
      if (!message.channel || !(message.channel.isTextBased() && 'send' in message.channel)) {
        await message.reply('Giveaways can only be created in regular text channels.');
        return;
      }
      
      const giveawayMsg = await message.channel.send({ embeds: [embed], components: [row] });
      
      // Update the giveaway with the message ID
      await db.update(giveaways)
        .set({ messageId: giveawayMsg.id, channelId: message.channel.id })
        .where(eq(giveaways.id, giveaway.id));
      
      // Confirmation to admin
      await message.reply({ content: `✅ Giveaway created successfully! ID: ${giveaway.id}` });
      
      // Set up a collector for the enter button
      const collector = message.channel.createMessageComponentCollector({
        filter: (i: any) => i.customId === `giveaway_enter_${giveaway.id}`, 
        time: durationInMs
      });
      
      collector.on('collect', async (interaction: ButtonInteraction) => {
        try {
          // Find the user in the database first
          const dbUser = await db.query.users.findFirst({
            where: eq(users.discordId, interaction.user.id),
          });
          
          // Check if user has already entered (only if user exists in db)
          const existingEntry = dbUser ? await db.query.giveawayEntries.findFirst({
            where: and(
              eq(giveawayEntries.giveawayId, giveaway.id),
              eq(giveawayEntries.userId, dbUser.id)
            )
          }) : null;
          
          if (existingEntry) {
            await interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
            return;
          }
          
          // Find or create user
          let user = await db.query.users.findFirst({
            where: eq(users.discordId, interaction.user.id),
          });
          
          if (!user) {
            const [newUser] = await db.insert(users)
              .values({
                discordId: interaction.user.id,
                username: interaction.user.username,
                avatarUrl: interaction.user.displayAvatarURL(),
              })
              .returning();
            user = newUser;
          }
          
          // Add entry to database
          await db.insert(giveawayEntries)
            .values({
              giveawayId: giveaway.id,
              userId: user.id,
              discordId: interaction.user.id,
              username: interaction.user.username,
              enteredAt: new Date()
            });
          
          // Get updated entry count
          const entryCount = await db.query.giveawayEntries.findMany({
            where: eq(giveawayEntries.giveawayId, giveaway.id),
          });
          
          // Update the embed with new entry count
          const updatedEmbed = EmbedBuilder.from(giveawayMsg.embeds[0])
            .setFields(
              { name: '🕒 Ends In', value: `<t:${Math.floor(endDate.getTime() / 1000)}:R>`, inline: true },
              { name: '🏆 Winners', value: '1', inline: true },
              { name: '👥 Entries', value: `${entryCount.length}`, inline: true },
              { name: 'ID', value: `${giveaway.id}`, inline: true }
            );
          
          await giveawayMsg.edit({ embeds: [updatedEmbed], components: [row] });
          
          await interaction.reply({ content: '✅ You have entered the giveaway! Good luck!', ephemeral: true });
        } catch (error) {
          console.error('Error handling giveaway entry:', error);
          await interaction.reply({ content: 'An error occurred while entering the giveaway. Please try again later.', ephemeral: true });
        }
      });
      
      collector.on('end', () => {
        // This will be triggered when the giveaway ends
        // The actual drawing of winners happens in handleEndGiveaway
      });
      
    } catch (error) {
      console.error('Error creating giveaway:', error);
      await message.reply('An error occurred while creating the giveaway. Please try again later.');
    }
  }
  
  private async handleEndGiveaway(message: Message, giveawayId: number): Promise<void> {
    try {
      // Get the giveaway
      const giveaway = await db.query.giveaways.findFirst({
        where: eq(giveaways.id, giveawayId),
      });
      
      if (!giveaway) {
        await message.reply(`Giveaway with ID ${giveawayId} not found.`);
        return;
      }
      
      if (giveaway.status !== 'active') {
        await message.reply(`Giveaway with ID ${giveawayId} is already ${giveaway.status}.`);
        return;
      }
      
      // Get all entries
      const entries = await db.query.giveawayEntries.findMany({
        where: eq(giveawayEntries.giveawayId, giveawayId),
        with: {
          user: true,
        },
      });
      
      if (entries.length === 0) {
        await message.reply(`No one entered the giveaway with ID ${giveawayId}.`);
        
        // Update giveaway status
        await db.update(giveaways)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(giveaways.id, giveawayId));
        
        // Try to update the original giveaway message
        try {
          const channel = this.client.channels.cache.get(giveaway.channelId!) as TextChannel;
          if (channel) {
            const giveawayMsg = await channel.messages.fetch(giveaway.messageId!);
            if (giveawayMsg) {
              const updatedEmbed = EmbedBuilder.from(giveawayMsg.embeds[0])
                .setColor(THEME.WARNING)
                .setTitle('🎁 Giveaway Ended - No Winners')
                .setDescription(`**${giveaway.name}**\n\nNo one entered this giveaway.`);
              
              const endedRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`giveaway_ended_${giveaway.id}`)
                    .setLabel('Giveaway Ended')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                );
              
              await giveawayMsg.edit({ embeds: [updatedEmbed], components: [endedRow] });
            }
          }
        } catch (error) {
          console.error('Error updating giveaway message:', error);
        }
        
        return;
      }
      
      // Pick winner(s)
      const winners = this.selectRandomWinners(entries, giveaway.winnerCount);
      const winnerIds = winners.map(w => w.userId);
      
      // Update giveaway status
      await db.update(giveaways)
        .set({ 
          status: 'completed', 
          updatedAt: new Date(),
          // Store winners as comma-separated IDs
          description: `Winners: ${winnerIds.join(',')}`
        })
        .where(eq(giveaways.id, giveawayId));
      
      // Create winners announcement
      let winnersList = '';
      for (const winner of winners) {
        winnersList += `<@${winner.user.discordId}> `;
      }
      
      // Try to update the original giveaway message
      try {
        const channel = this.client.channels.cache.get(giveaway.channelId!) as TextChannel;
        if (channel) {
          const giveawayMsg = await channel.messages.fetch(giveaway.messageId!);
          if (giveawayMsg) {
            const updatedEmbed = EmbedBuilder.from(giveawayMsg.embeds[0])
              .setColor(THEME.SUCCESS)
              .setTitle('🎁 Giveaway Ended')
              .setDescription(`**${giveaway.name}**\n\n**Winner${winners.length > 1 ? 's' : ''}:** ${winnersList}\n\nCongratulations! 🎉`);
            
            const endedRow = new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`giveaway_ended_${giveaway.id}`)
                  .setLabel('Giveaway Ended')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true)
              );
            
            await giveawayMsg.edit({ embeds: [updatedEmbed], components: [endedRow] });
            
            // Send announcement if channel supports it
            if ('send' in channel) {
              await channel.send(`🎉 Congratulations to the winner${winners.length > 1 ? 's' : ''} of the **${giveaway.name}** giveaway: ${winnersList}`);
            }
          }
        }
      } catch (error) {
        console.error('Error updating giveaway message:', error);
      }
      
      await message.reply(`✅ Giveaway with ID ${giveawayId} has ended and winner${winners.length > 1 ? 's have' : ' has'} been selected!`);
      
    } catch (error) {
      console.error('Error ending giveaway:', error);
      await message.reply('An error occurred while ending the giveaway. Please try again later.');
    }
  }
  
  private async handleCancelGiveaway(message: Message, giveawayId: number): Promise<void> {
    try {
      // Get the giveaway
      const giveaway = await db.query.giveaways.findFirst({
        where: eq(giveaways.id, giveawayId),
      });
      
      if (!giveaway) {
        await message.reply(`Giveaway with ID ${giveawayId} not found.`);
        return;
      }
      
      if (giveaway.status !== 'active') {
        await message.reply(`Giveaway with ID ${giveawayId} is already ${giveaway.status}.`);
        return;
      }
      
      // Update giveaway status
      await db.update(giveaways)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(giveaways.id, giveawayId));
      
      // Try to update the original giveaway message
      try {
        const channel = this.client.channels.cache.get(giveaway.channelId!) as TextChannel;
        if (channel) {
          const giveawayMsg = await channel.messages.fetch(giveaway.messageId!);
          if (giveawayMsg) {
            const updatedEmbed = EmbedBuilder.from(giveawayMsg.embeds[0])
              .setColor(THEME.ERROR)
              .setTitle('🎁 Giveaway Cancelled')
              .setDescription(`**${giveaway.name}**\n\nThis giveaway has been cancelled by an administrator.`);
            
            const cancelledRow = new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`giveaway_cancelled_${giveaway.id}`)
                  .setLabel('Giveaway Cancelled')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true)
              );
            
            await giveawayMsg.edit({ embeds: [updatedEmbed], components: [cancelledRow] });
            
            // Send announcement if channel supports it
            if ('send' in channel) {
              await channel.send(`🛑 The giveaway for **${giveaway.name}** has been cancelled by an administrator.`);
            }
          }
        }
      } catch (error) {
        console.error('Error updating giveaway message:', error);
      }
      
      await message.reply(`✅ Giveaway with ID ${giveawayId} has been cancelled.`);
      
    } catch (error) {
      console.error('Error cancelling giveaway:', error);
      await message.reply('An error occurred while cancelling the giveaway. Please try again later.');
    }
  }
  
  private async handleListGiveawaysCommand(message: Message): Promise<void> {
    try {
      // Get all active giveaways
      const activeGiveaways = await db.query.giveaways.findMany({
        where: eq(giveaways.status, 'active'),
        orderBy: (giveaways, { asc }) => [asc(giveaways.endTime)],
      });
      
      if (activeGiveaways.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🎁 Active Giveaways')
          .setColor(THEME.INFO)
          .setDescription('There are no active giveaways at the moment.')
          .setFooter({ text: `Use ${PREFIX}giveaway create to start a new giveaway (admin only)` });
        
        await message.reply({ embeds: [embed] });
        return;
      }
      
      const embed = new EmbedBuilder()
        .setTitle('🎁 Active Giveaways')
        .setColor(THEME.INFO)
        .setDescription('Here are all the active giveaways:');
      
      for (const giveaway of activeGiveaways) {
        // Get entry count
        const entryCount = await db.query.giveawayEntries.findMany({
          where: eq(giveawayEntries.giveawayId, giveaway.id),
        });
        
        // Add field for each giveaway
        embed.addFields({
          name: `${giveaway.name} (ID: ${giveaway.id})`,
          value: 
            `⏰ Ends: <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>\n` +
            `👥 Entries: ${entryCount.length}\n` +
            `🏆 Winners: ${giveaway.winnerCount}\n` +
            `📍 [Go to Giveaway](https://discord.com/channels/${message.guild?.id}/${giveaway.channelId}/${giveaway.messageId})`
        });
      }
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error listing giveaways:', error);
      await message.reply('An error occurred while listing giveaways. Please try again later.');
    }
  }
  
  private selectRandomWinners(entries: any[], winnerCount: number): any[] {
    const entryCount = entries.length;
    const actualWinnerCount = Math.min(winnerCount, entryCount);
    
    if (actualWinnerCount === 0) return [];
    if (actualWinnerCount === entryCount) return entries;
    
    const winners = [];
    const entriesCopy = [...entries];
    
    for (let i = 0; i < actualWinnerCount; i++) {
      const randomIndex = Math.floor(Math.random() * entriesCopy.length);
      winners.push(entriesCopy[randomIndex]);
      entriesCopy.splice(randomIndex, 1);
    }
    
    return winners;
  }
  
  private parseDuration(durationStr: string): number {
    let totalMs = 0;
    
    // Check for days (e.g., "1d", "2d")
    const daysMatch = durationStr.match(/(\d+)d/);
    if (daysMatch) {
      totalMs += parseInt(daysMatch[1], 10) * 24 * 60 * 60 * 1000;
    }
    
    // Check for hours (e.g., "1h", "2h")
    const hoursMatch = durationStr.match(/(\d+)h/);
    if (hoursMatch) {
      totalMs += parseInt(hoursMatch[1], 10) * 60 * 60 * 1000;
    }
    
    // Check for minutes (e.g., "1m", "2m")
    const minutesMatch = durationStr.match(/(\d+)m/);
    if (minutesMatch) {
      totalMs += parseInt(minutesMatch[1], 10) * 60 * 1000;
    }
    
    // If no valid duration provided, try interpreting as a direct minute value
    if (totalMs === 0 && /^\d+$/.test(durationStr)) {
      totalMs = parseInt(durationStr, 10) * 60 * 1000;
    }
    
    return totalMs;
  }
  
  /**
   * Moderation Commands Help Panel
   */
  private async handleModHelpCommand(message: Message): Promise<void> {
    // Check if user is in admin list
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use moderation commands.');
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Event Avengers Moderation Commands 🛡️')
      .setColor(THEME.WARNING)
      .setDescription(`${EVENT_BANNER}\n\n**Moderation Command Reference**\n\nThese commands are restricted to server moderators only.`)
      .addFields(
        { 
          name: '👤 USER MODERATION',
          value: 
            `\`${PREFIX}mute @user [reason]\` - Mute a user\n` +
            `\`${PREFIX}unmute @user\` - Unmute a user\n` +
            `\`${PREFIX}timeout @user [duration] [reason]\` - Timeout a user (1m, 1h, 1d)\n` +
            `\`${PREFIX}removetimeout @user\` - Remove a timeout\n` +
            `\`${PREFIX}kick @user [reason]\` - Kick a user from the server\n` +
            `\`${PREFIX}ban @user [days] [reason]\` - Ban a user (days = delete messages)\n` +
            `\`${PREFIX}unban userId\` - Unban a user by ID\n` +
            `\`${PREFIX}warn @user [reason]\` - Give a warning to a user\n` +
            `\`${PREFIX}warnings @user\` - See user's warning history`
        },
        { 
          name: '📝 CHANNEL MODERATION',  
          value: 
            `\`${PREFIX}lock\` - Lock the current channel\n` +
            `\`${PREFIX}unlock\` - Unlock the current channel\n` +
            `\`${PREFIX}close\` - Make a channel invisible to regular users\n` +
            `\`${PREFIX}open\` - Make a channel visible again\n` +
            `\`${PREFIX}slowmode [seconds]\` - Set slowmode in the current channel\n` +
            `\`${PREFIX}purge [amount]\` - Delete messages (1-100)\n` +
            `\`${PREFIX}nuke\` - Clear a channel by recreating it`
        },
        {
          name: '🏷️ ROLE MANAGEMENT',
          value:
            `\`${PREFIX}addrole @user role_name\` - Add a role to a user\n` +
            `\`${PREFIX}removerole @user role_name\` - Remove a role from a user\n` +
            `\`${PREFIX}roleinfo role_name\` - Show information about a role`
        },
        {
          name: '🔍 SERVER UTILITIES',
          value:
            `\`${PREFIX}serverinfo\` - Show information about the server\n` +
            `\`${PREFIX}userinfo @user\` - Show detailed information about a user\n` +
            `\`${PREFIX}announce #channel message\` - Send an announcement to a channel`
        }
      )
      .setThumbnail('https://cdn.discordapp.com/icons/1342945804985307198/7d65a9a24b64385086f6d2879fa82bb4.webp?size=80&quality=lossless')
      .setFooter({ text: '✧✦✧ Event Avengers Moderator Tools v1.0 ✧✦✧ RESTRICTED COMMANDS ✧✦✧' });
    
    await message.reply({ embeds: [embed] });
  }
  
  /**
   * User Moderation Commands
   */
  
  private async handleMuteCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if target was mentioned
    if (message.mentions.members?.size === 0) {
      await message.reply('Please mention a user to mute.');
      return;
    }
    
    const targetMember = message.mentions.members.first();
    if (!targetMember) {
      await message.reply('Could not find the mentioned user.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await message.reply('I do not have permission to manage roles.');
      return;
    }
    
    try {
      // Get or create muted role
      let mutedRole = message.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted');
      
      if (!mutedRole) {
        // Create muted role if it doesn't exist
        mutedRole = await message.guild.roles.create({
          name: 'Muted',
          color: Colors.DarkGrey,
          reason: 'Created for muting users',
          permissions: []
        });
        
        // Update all text channels to deny sending messages for this role
        message.guild.channels.cache.forEach(async (channel) => {
          if (channel.isTextBased()) {
            await channel.permissionOverwrites.create(mutedRole!, {
              SendMessages: false,
              AddReactions: false
            });
          }
        });
      }
      
      // Get reason
      args.shift(); // Remove the mention
      const reason = args.length > 0 ? args.join(' ') : 'No reason provided';
      
      // Add role to user
      await targetMember.roles.add(mutedRole, reason);
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('🔇 User Muted')
        .setDescription(`${targetMember.user.username} has been muted.`)
        .setColor(THEME.WARNING)
        .addFields({ name: 'Reason', value: reason })
        .setFooter({ text: `Muted by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
      
      // Try to DM the user (if allowed)
      try {
        await targetMember.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`You have been muted in ${message.guild.name}`)
              .setDescription(`**Reason:** ${reason}`)
              .setColor(THEME.WARNING)
              .setTimestamp()
          ]
        });
      } catch (error) {
        // Silently fail if can't DM (user has DMs closed)
      }
    } catch (error) {
      console.error('Error muting user:', error);
      await message.reply('Failed to mute the user. Make sure I have the necessary permissions and the user is not higher in role hierarchy.');
    }
  }
  
  private async handleUnmuteCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if target was mentioned
    if (message.mentions.members?.size === 0) {
      await message.reply('Please mention a user to unmute.');
      return;
    }
    
    const targetMember = message.mentions.members.first();
    if (!targetMember) {
      await message.reply('Could not find the mentioned user.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await message.reply('I do not have permission to manage roles.');
      return;
    }
    
    try {
      // Get muted role
      const mutedRole = message.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted');
      
      if (!mutedRole) {
        await message.reply('There is no muted role set up in this server.');
        return;
      }
      
      // Check if user has the muted role
      if (!targetMember.roles.cache.has(mutedRole.id)) {
        await message.reply(`${targetMember.user.username} is not muted.`);
        return;
      }
      
      // Remove the role
      await targetMember.roles.remove(mutedRole, `Unmuted by ${message.author.username}`);
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('🔊 User Unmuted')
        .setDescription(`${targetMember.user.username} has been unmuted.`)
        .setColor(THEME.SUCCESS)
        .setFooter({ text: `Unmuted by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
      
      // Try to DM the user (if allowed)
      try {
        await targetMember.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`You have been unmuted in ${message.guild.name}`)
              .setColor(THEME.SUCCESS)
              .setTimestamp()
          ]
        });
      } catch (error) {
        // Silently fail if can't DM (user has DMs closed)
      }
    } catch (error) {
      console.error('Error unmuting user:', error);
      await message.reply('Failed to unmute the user. Make sure I have the necessary permissions.');
    }
  }
  
  private async handleTimeoutCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if target was mentioned
    if (message.mentions.members?.size === 0) {
      await message.reply('Please mention a user to timeout.');
      return;
    }
    
    const targetMember = message.mentions.members.first();
    if (!targetMember) {
      await message.reply('Could not find the mentioned user.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await message.reply('I do not have permission to timeout members.');
      return;
    }
    
    try {
      // Get parameters
      args.shift(); // Remove the mention
      
      let duration = 60 * 1000; // Default: 1 minute
      let reason = 'No reason provided';
      
      if (args.length > 0) {
        // Try to parse duration
        if (/^\d+[mhd]?$/.test(args[0])) {
          duration = this.parseDuration(args[0]);
          args.shift(); // Remove duration
        }
        
        if (args.length > 0) {
          reason = args.join(' ');
        }
      }
      
      // Ensure duration doesn't exceed max (28 days)
      const maxTimeout = 28 * 24 * 60 * 60 * 1000;
      if (duration > maxTimeout) {
        duration = maxTimeout;
      }
      
      // Apply timeout
      await targetMember.timeout(duration, reason);
      
      // Format the duration for display
      let durationText = '';
      const days = Math.floor(duration / (24 * 60 * 60 * 1000));
      const hours = Math.floor((duration % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((duration % (60 * 60 * 1000)) / (60 * 1000));
      
      if (days > 0) durationText += `${days} day${days !== 1 ? 's' : ''} `;
      if (hours > 0) durationText += `${hours} hour${hours !== 1 ? 's' : ''} `;
      if (minutes > 0) durationText += `${minutes} minute${minutes !== 1 ? 's' : ''} `;
      if (durationText === '') durationText = 'less than a minute';
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('⏰ User Timed Out')
        .setDescription(`${targetMember.user.username} has been timed out.`)
        .setColor(THEME.WARNING)
        .addFields(
          { name: 'Duration', value: durationText, inline: true },
          { name: 'Reason', value: reason, inline: true }
        )
        .setFooter({ text: `Timed out by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
      
      // Try to DM the user (if allowed)
      try {
        await targetMember.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`You have been timed out in ${message.guild.name}`)
              .setDescription(`**Duration:** ${durationText}\n**Reason:** ${reason}`)
              .setColor(THEME.WARNING)
              .setTimestamp()
          ]
        });
      } catch (error) {
        // Silently fail if can't DM (user has DMs closed)
      }
    } catch (error) {
      console.error('Error timing out user:', error);
      await message.reply('Failed to timeout the user. Make sure I have the necessary permissions and the user is not higher in role hierarchy.');
    }
  }
  
  private async handleRemoveTimeoutCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if target was mentioned
    if (message.mentions.members?.size === 0) {
      await message.reply('Please mention a user to remove timeout from.');
      return;
    }
    
    const targetMember = message.mentions.members.first();
    if (!targetMember) {
      await message.reply('Could not find the mentioned user.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await message.reply('I do not have permission to manage timeouts.');
      return;
    }
    
    try {
      // Check if user is timed out
      if (!targetMember.communicationDisabledUntil) {
        await message.reply(`${targetMember.user.username} is not timed out.`);
        return;
      }
      
      // Remove timeout
      await targetMember.timeout(null, `Timeout removed by ${message.author.username}`);
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('⏰ Timeout Removed')
        .setDescription(`Timeout has been removed from ${targetMember.user.username}.`)
        .setColor(THEME.SUCCESS)
        .setFooter({ text: `Removed by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
      
      // Try to DM the user (if allowed)
      try {
        await targetMember.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Your timeout in ${message.guild.name} has been removed`)
              .setColor(THEME.SUCCESS)
              .setTimestamp()
          ]
        });
      } catch (error) {
        // Silently fail if can't DM (user has DMs closed)
      }
    } catch (error) {
      console.error('Error removing timeout:', error);
      await message.reply('Failed to remove the timeout. Make sure I have the necessary permissions.');
    }
  }
  
  /**
   * Channel Moderation Commands
   */
  
  private async handleLockChannelCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('I do not have permission to manage channels.');
      return;
    }
    
    try {
      const channel = message.channel;
      if (!channel.isTextBased()) {
        await message.reply('This command can only be used in text channels.');
        return;
      }
      
      // Get reason
      const reason = args.length > 0 ? args.join(' ') : 'No reason provided';
      
      // Lock the channel by updating permissions for @everyone role
      const everyoneRole = message.guild.roles.everyone;
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false
      }, { reason: `Channel locked by ${message.author.username}: ${reason}` });
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('🔒 Channel Locked')
        .setDescription(`This channel has been locked by a moderator.`)
        .setColor(THEME.WARNING)
        .addFields({ name: 'Reason', value: reason })
        .setFooter({ text: `Locked by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error locking channel:', error);
      await message.reply('Failed to lock the channel. Make sure I have the necessary permissions.');
    }
  }
  
  private async handleUnlockChannelCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('I do not have permission to manage channels.');
      return;
    }
    
    try {
      const channel = message.channel;
      if (!channel.isTextBased()) {
        await message.reply('This command can only be used in text channels.');
        return;
      }
      
      // Get the @everyone role
      const everyoneRole = message.guild.roles.everyone;
      
      // Check current permissions to see if we need to remove the override or set it to null
      const currentPermissions = channel.permissionOverwrites.cache.get(everyoneRole.id);
      
      if (currentPermissions) {
        // Check if SendMessages is explicitly disabled
        if (currentPermissions.deny.has(PermissionFlagsBits.SendMessages)) {
          // Update the permission to allow sending messages again
          await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: null // Reset to default
          }, { reason: `Channel unlocked by ${message.author.username}` });
        } else {
          await message.reply('This channel does not appear to be locked.');
          return;
        }
      } else {
        await message.reply('This channel does not appear to be locked.');
        return;
      }
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('🔓 Channel Unlocked')
        .setDescription(`This channel has been unlocked.`)
        .setColor(THEME.SUCCESS)
        .setFooter({ text: `Unlocked by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error unlocking channel:', error);
      await message.reply('Failed to unlock the channel. Make sure I have the necessary permissions.');
    }
  }
  
  private async handleCloseChannelCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('I do not have permission to manage channels.');
      return;
    }
    
    try {
      const channel = message.channel;
      
      // Get reason
      const reason = args.length > 0 ? args.join(' ') : 'No reason provided';
      
      // Close the channel by updating permissions for @everyone role
      const everyoneRole = message.guild.roles.everyone;
      await channel.permissionOverwrites.edit(everyoneRole, {
        ViewChannel: false
      }, { reason: `Channel closed by ${message.author.username}: ${reason}` });
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('🚫 Channel Closed')
        .setDescription(`This channel has been closed and is now hidden from regular users.`)
        .setColor(THEME.WARNING)
        .addFields({ name: 'Reason', value: reason })
        .setFooter({ text: `Closed by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error closing channel:', error);
      await message.reply('Failed to close the channel. Make sure I have the necessary permissions.');
    }
  }
  
  private async handleOpenChannelCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('I do not have permission to manage channels.');
      return;
    }
    
    try {
      const channel = message.channel;
      
      // Get the @everyone role
      const everyoneRole = message.guild.roles.everyone;
      
      // Check current permissions
      const currentPermissions = channel.permissionOverwrites.cache.get(everyoneRole.id);
      
      if (currentPermissions) {
        // Check if ViewChannel is explicitly disabled
        if (currentPermissions.deny.has(PermissionFlagsBits.ViewChannel)) {
          // Update the permission to allow viewing channel again
          await channel.permissionOverwrites.edit(everyoneRole, {
            ViewChannel: null // Reset to default
          }, { reason: `Channel opened by ${message.author.username}` });
          
          // Send confirmation
          const embed = new EmbedBuilder()
            .setTitle('👁️ Channel Opened')
            .setDescription(`This channel has been opened and is now visible to regular users.`)
            .setColor(THEME.SUCCESS)
            .setFooter({ text: `Opened by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();
          
          await message.channel.send({ embeds: [embed] });
        } else {
          await message.reply('This channel does not appear to be closed.');
          return;
        }
      } else {
        await message.reply('This channel does not appear to be closed.');
        return;
      }
    } catch (error) {
      console.error('Error opening channel:', error);
      await message.reply('Failed to open the channel. Make sure I have the necessary permissions.');
    }
  }
  
  private async handleSlowmodeCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('I do not have permission to manage channels.');
      return;
    }
    
    try {
      const channel = message.channel;
      if (!channel.isTextBased() || !('setRateLimitPerUser' in channel)) {
        await message.reply('This command can only be used in text channels.');
        return;
      }
      
      // Parse seconds
      let seconds = 0;
      if (args.length > 0) {
        const input = parseInt(args[0]);
        if (!isNaN(input)) {
          seconds = Math.min(Math.max(input, 0), 21600); // Limit to 0-21600 seconds (6 hours)
        } else {
          await message.reply('Please provide a valid number of seconds for slowmode (0-21600).');
          return;
        }
      }
      
      // Set slowmode
      await channel.setRateLimitPerUser(seconds, `Slowmode ${seconds > 0 ? 'enabled' : 'disabled'} by ${message.author.username}`);
      
      // Send confirmation
      if (seconds === 0) {
        const embed = new EmbedBuilder()
          .setTitle('⏱️ Slowmode Disabled')
          .setDescription(`Slowmode has been disabled in this channel.`)
          .setColor(THEME.SUCCESS)
          .setFooter({ text: `Disabled by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
          .setTimestamp();
        
        await message.reply({ embeds: [embed] });
      } else {
        // Format duration text
        let durationText = '';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        if (hours > 0) durationText += `${hours} hour${hours !== 1 ? 's' : ''} `;
        if (minutes > 0) durationText += `${minutes} minute${minutes !== 1 ? 's' : ''} `;
        if (remainingSeconds > 0 || (hours === 0 && minutes === 0)) durationText += `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
        
        const embed = new EmbedBuilder()
          .setTitle('⏱️ Slowmode Enabled')
          .setDescription(`Slowmode has been set to ${durationText} in this channel.`)
          .setColor(THEME.WARNING)
          .setFooter({ text: `Enabled by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
          .setTimestamp();
        
        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error setting slowmode:', error);
      await message.reply('Failed to set slowmode. Make sure I have the necessary permissions.');
    }
  }
  
  private async handlePurgeCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.reply('I do not have permission to manage messages.');
      return;
    }
    
    try {
      const channel = message.channel;
      if (!channel.isTextBased() || !('bulkDelete' in channel)) {
        await message.reply('This command can only be used in text channels.');
        return;
      }
      
      // Parse amount
      let amount = 10; // Default
      if (args.length > 0) {
        const input = parseInt(args[0]);
        if (!isNaN(input)) {
          amount = Math.min(Math.max(input, 1), 100); // Limit to 1-100 messages
        } else {
          await message.reply('Please provide a valid number of messages to delete (1-100).');
          return;
        }
      }
      
      // Delete messages
      const deleted = await channel.bulkDelete(amount, true);
      
      // Send confirmation as ephemeral message
      const tempMessage = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🗑️ Messages Purged')
            .setDescription(`Successfully deleted ${deleted.size} message${deleted.size !== 1 ? 's' : ''}.`)
            .setColor(THEME.SUCCESS)
            .setFooter({ text: `Purged by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp()
        ]
      });
      
      // Auto-delete the confirmation after 5 seconds
      setTimeout(() => {
        tempMessage.delete().catch(() => {}); // Silently fail if already deleted
      }, 5000);
    } catch (error) {
      console.error('Error purging messages:', error);
      await message.reply('Failed to purge messages. Make sure messages are not older than 14 days and I have the necessary permissions.');
    }
  }
  
  private async handleNukeCommand(message: Message, args: string[]): Promise<void> {
    // Check permission - admin only
    if (!ADMIN_IDS.includes(message.author.id)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('I do not have permission to manage channels.');
      return;
    }
    
    try {
      const channel = message.channel;
      
      // Ask for confirmation first
      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirm Channel Nuke')
        .setDescription(`Are you sure you want to nuke this channel? This will:
        1. Create a clone of this channel with the same permissions
        2. Delete this channel entirely
        3. All messages will be permanently lost
        
        **This action cannot be undone!**`)
        .setColor(THEME.ERROR)
        .setFooter({ text: 'Reply with "confirm" within 15 seconds to proceed' });
      
      await message.reply({ embeds: [confirmEmbed] });
      
      // Create a filter for the collector
      const filter = (m: Message) => m.author.id === message.author.id && m.content.toLowerCase() === 'confirm';
      
      // Start the collector
      const collector = message.channel.createMessageCollector({ filter, time: 15000, max: 1 });
      
      collector.on('collect', async () => {
        try {
          // Get channel info
          const channelName = channel.name;
          const channelPosition = ('position' in channel) ? channel.position : 0;
          const channelParentId = ('parent' in channel && channel.parent) ? channel.parent.id : null;
          
          // Get permission overwrites
          const permissionOverwrites = Array.from(channel.permissionOverwrites.cache.values()).map(overwrite => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield.toString(),
            deny: overwrite.deny.bitfield.toString()
          }));
          
          // Send notice that we're proceeding
          if ('send' in channel) {
            await channel.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle('💥 Channel Nuke In Progress')
                  .setDescription('This channel is being nuked. A new channel will be created momentarily.')
                  .setColor(THEME.ERROR)
                  .setFooter({ text: `Nuked by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
                  .setTimestamp()
              ]
            });
          }
          
          // Create a new channel
          const newChannel = await message.guild!.channels.create({
            name: channelName,
            type: channel.type,
            topic: ('topic' in channel) ? channel.topic || undefined : undefined,
            nsfw: ('nsfw' in channel) ? channel.nsfw : false,
            parent: channelParentId,
            position: channelPosition,
          });
          
          // Add permission overwrites
          for (const overwrite of permissionOverwrites) {
            try {
              // Check if the ID is a valid user or role
              const roleOrUser = 
                message.guild!.roles.cache.get(overwrite.id) || 
                await message.guild!.members.fetch(overwrite.id).then(m => m.user).catch(() => null);
              
              if (roleOrUser) {
                await newChannel.permissionOverwrites.create(
                  roleOrUser,
                  {
                    allow: BigInt(overwrite.allow || '0'),
                    deny: BigInt(overwrite.deny || '0')
                  }
                );
              }
            } catch (err) {
              console.error(`Error setting permission for ${overwrite.id}:`, err);
              // Continue with next overwrite even if one fails
            }
          }
          
          // Delete the old channel
          await channel.delete(`Channel nuked by ${message.author.username}`);
          
          // Send confirmation in new channel
          await newChannel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('💥 Channel Nuked')
                .setDescription('This channel has been nuked and recreated. All previous messages have been deleted.')
                .setColor(THEME.WARNING)
                .setFooter({ text: `Nuked by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp()
            ]
          });
        } catch (error) {
          console.error('Error nuking channel:', error);
          if ('send' in channel) {
            await channel.send('Failed to nuke the channel. Make sure I have the necessary permissions.');
          }
        }
      });
      
      collector.on('end', collected => {
        if (collected.size === 0 && 'send' in channel) {
          channel.send('Channel nuke cancelled due to timeout.').catch(() => {});
        }
      });
    } catch (error) {
      console.error('Error starting nuke process:', error);
      await message.reply('Failed to start the nuke process. Make sure I have the necessary permissions.');
    }
  }
  
  /**
   * Kick, Ban, and Warning Commands
   */
  
  private async handleKickCommand(message: Message, args: string[]): Promise<void> {
    // Check permission
    const member = message.member;
    if (!member || (!ADMIN_IDS.includes(message.author.id) && !member.permissions.has(PermissionFlagsBits.KickMembers))) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if target was mentioned
    if (message.mentions.members?.size === 0) {
      await message.reply('Please mention a user to kick.');
      return;
    }
    
    const targetMember = message.mentions.members.first();
    if (!targetMember) {
      await message.reply('Could not find the mentioned user.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) {
      await message.reply('I do not have permission to kick members.');
      return;
    }
    
    // Check if target is kickable
    if (!targetMember.kickable) {
      await message.reply(`I cannot kick ${targetMember.user.username}. They may have higher permissions than me.`);
      return;
    }
    
    try {
      // Get reason
      args.shift(); // Remove the mention
      const reason = args.length > 0 ? args.join(' ') : 'No reason provided';
      
      // Send DM to the user being kicked
      try {
        await targetMember.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`You have been kicked from ${message.guild.name}`)
              .setDescription(`**Reason:** ${reason}`)
              .setColor(THEME.ERROR)
              .setTimestamp()
          ]
        });
      } catch (error) {
        // Silently fail if can't DM (user has DMs closed)
      }
      
      // Kick the user
      await targetMember.kick(`Kicked by ${message.author.username}: ${reason}`);
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('👢 User Kicked')
        .setDescription(`${targetMember.user.username} has been kicked from the server.`)
        .setColor(THEME.WARNING)
        .addFields({ name: 'Reason', value: reason })
        .setFooter({ text: `Kicked by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error kicking user:', error);
      await message.reply('Failed to kick the user. Make sure I have the necessary permissions and the user is not higher in role hierarchy.');
    }
  }
  
  private async handleBanCommand(message: Message, args: string[]): Promise<void> {
    // Check permission
    const member = message.member;
    if (!member || (!ADMIN_IDS.includes(message.author.id) && !member.permissions.has(PermissionFlagsBits.BanMembers))) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if target was mentioned
    if (message.mentions.members?.size === 0) {
      await message.reply('Please mention a user to ban.');
      return;
    }
    
    const targetMember = message.mentions.members.first();
    if (!targetMember) {
      await message.reply('Could not find the mentioned user.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      await message.reply('I do not have permission to ban members.');
      return;
    }
    
    // Check if target is bannable
    if (!targetMember.bannable) {
      await message.reply(`I cannot ban ${targetMember.user.username}. They may have higher permissions than me.`);
      return;
    }
    
    try {
      args.shift(); // Remove the mention
      
      // Parse delete message days
      let deleteMessageDays = 0;
      if (args.length > 0 && !isNaN(parseInt(args[0]))) {
        deleteMessageDays = Math.min(Math.max(parseInt(args[0]), 0), 7); // Limit to 0-7 days
        args.shift(); // Remove the days parameter
      }
      
      // Get reason
      const reason = args.length > 0 ? args.join(' ') : 'No reason provided';
      
      // Send DM to the user being banned
      try {
        await targetMember.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`You have been banned from ${message.guild.name}`)
              .setDescription(`**Reason:** ${reason}`)
              .setColor(THEME.ERROR)
              .setTimestamp()
          ]
        });
      } catch (error) {
        // Silently fail if can't DM (user has DMs closed)
      }
      
      // Ban the user
      await targetMember.ban({
        deleteMessageDays,
        reason: `Banned by ${message.author.username}: ${reason}`
      });
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('🔨 User Banned')
        .setDescription(`${targetMember.user.username} has been banned from the server.`)
        .setColor(THEME.ERROR)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Message Deletion', value: `${deleteMessageDays} day${deleteMessageDays !== 1 ? 's' : ''}`, inline: true }
        )
        .setFooter({ text: `Banned by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error banning user:', error);
      await message.reply('Failed to ban the user. Make sure I have the necessary permissions and the user is not higher in role hierarchy.');
    }
  }
  
  private async handleUnbanCommand(message: Message, args: string[]): Promise<void> {
    // Check permission
    const member = message.member;
    if (!member || (!ADMIN_IDS.includes(message.author.id) && !member.permissions.has(PermissionFlagsBits.BanMembers))) {
      await message.reply('You do not have permission to use this command.');
      return;
    }
    
    // Check if bot has permission
    if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      await message.reply('I do not have permission to unban members.');
      return;
    }
    
    // Check if user ID was provided
    if (args.length === 0) {
      await message.reply('Please provide the ID of the user to unban.');
      return;
    }
    
    const userId = args[0];
    
    try {
      // Fetch ban list
      const bans = await message.guild.bans.fetch();
      
      // Check if user is banned
      const bannedUser = bans.find(ban => ban.user.id === userId);
      if (!bannedUser) {
        await message.reply('This user is not banned.');
        return;
      }
      
      // Unban the user
      await message.guild.members.unban(userId, `Unbanned by ${message.author.username}`);
      
      // Send confirmation
      const embed = new EmbedBuilder()
        .setTitle('🔓 User Unbanned')
        .setDescription(`${bannedUser.user.username} has been unbanned from the server.`)
        .setColor(THEME.SUCCESS)
        .setFooter({ text: `Unbanned by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error unbanning user:', error);
      await message.reply('Failed to unban the user. Make sure the user ID is valid and I have the necessary permissions.');
    }
  }
}

export default new DiscordBot();
