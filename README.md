# Event Avengers Discord Bot

A Discord bot for the Event Avengers server that creates an engaging, community-driven experience through gamified interactions and dynamic branding.

## Features

- Points system with admin-only commands for awarding and removing points
- Rich visual leaderboard with server branding
- Interactive betting system with multi-round coin flip games
- Admin-only countdown feature for tracking events
- Multiple other commands for checking points, ranks, and more
- 24/7 uptime with redundant ping systems

## Commands

### Admin Commands
- `!givepoints @user <amount>` - Award points to a user
- `!removepoints @user <amount>` - Deduct points from a user
- `!msg <message>` - Make the bot send a custom message
- `!countdown "Event Name" MM/DD/YYYY [description]` - Create event countdown
- `!countdown "Event Name" 30 mins [description]` - Create event countdown with relative time
- `!countdowns` - List all active countdowns
- `!deletecountdown <id>` - Remove a countdown by its ID

### User Commands
- `!leaderboard` or `!lb` - View top 10 users
- `!lb <number>` - Show top X users (from 1-15)  
- `!points` or `!mypoints` - Check your current points
- `!rank` - Check your position in the rankings
- `!rank @user` - Check another user's rank
- `!shop` - View available rewards to spend points on
- `!earnpoints` - Learn how to earn points in the server
- `!help` - Display the commands list

### Betting Commands
- `!bet @user <amount>` - Challenge someone to a coin flip bet

## 24/7 Uptime Configuration

The bot uses a comprehensive uptime solution that includes:

1. Multiple health check endpoints for monitoring:
   - `/ping` - Returns detailed JSON status information
   - `/health` - Simple text confirmation that the bot is online
   - `/status` - Alternative endpoint for redundancy

2. Self-ping mechanism:
   - The bot pings itself every 2 minutes
   - Uses fallback endpoints every 3 minutes
   - Has automatic retry logic for failed pings

3. Enhanced internal ping system:
   - Multiple ping strategies working simultaneously
   - Randomized timing to avoid detection by monitoring systems
   - Automatic retries when pings fail
   - Rotational ping endpoints for redundancy

4. UptimeRobot Integration:
   - Set up a monitor at https://uptimerobot.com/
   - Add a HTTP(s) monitor to check these URLs:
     - `https://your-repl-name.your-username.repl.co/ping`
     - `https://your-repl-name.your-username.repl.co/health`
     - `https://your-repl-name.your-username.repl.co/status`
   - Set checking interval to 5 minutes
   - Enable alert contacts for downtime notifications

With this setup, the bot should achieve near-perfect uptime, even when the Replit tab is closed.