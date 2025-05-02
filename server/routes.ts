import type { Express } from "express";
import { createServer, type Server } from "http";
import discordBot from "./discord-bot";
import fetch from "node-fetch";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  
  // Enhanced health check endpoints for uptime monitoring
  app.get('/ping', (req, res) => {
    // Add more detailed status info
    const status = {
      bot: discordBot.isConnected() ? 'online' : 'offline',
      server: 'online',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
    res.status(200).json(status);
    log(`Health check requested from ${req.ip || 'unknown'} to /ping`, 'routes');
  });
  
  // Simple text response for lightweight checks
  app.get('/health', (req, res) => {
    res.status(200).send('Bot is online!');
    log(`Health check requested from ${req.ip || 'unknown'} to /health`, 'routes');
  });
  
  // Alternative URL paths in case one gets blocked
  app.get('/status', (req, res) => {
    res.status(200).send('Bot is running!');
    log(`Health check requested from ${req.ip || 'unknown'} to /status`, 'routes');
  });
  
  // Bot status endpoint
  app.get('/api/bot/status', async (req, res) => {
    try {
      const status = discordBot.getStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error fetching bot status:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch bot status' 
      });
    }
  });

  // Leaderboard endpoint
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const leaderboard = await discordBot.getLeaderboard();
      res.json({
        success: true,
        data: leaderboard
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch leaderboard' 
      });
    }
  });
  
  // API route for countdowns
  app.get('/api/countdowns', async (req, res) => {
    try {
      // Get active countdowns from database
      const countdowns = await storage.getCountdowns();
      
      // Update remaining time for each countdown
      const updatedCountdowns = countdowns.map((countdown) => {
        const targetDate = new Date(countdown.targetDate);
        const now = new Date();
        const timeRemaining = targetDate.getTime() - now.getTime();
        
        return {
          ...countdown,
          remaining: timeRemaining > 0 ? timeRemaining : 0,
          isExpired: timeRemaining <= 0
        };
      });
      
      res.status(200).json({
        success: true,
        data: updatedCountdowns
      });
    } catch (error) {
      console.error('Error getting countdowns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get countdown data'
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up a WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    log('WebSocket client connected', 'websocket');
    
    // Send initial data
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      data: { timestamp: new Date().toISOString() }
    }));
    
    // Handle WebSocket messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        // Handle different message types here
        log(`Received message: ${data.type}`, 'websocket');
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Handle WebSocket close
    ws.on('close', () => {
      log('WebSocket client disconnected', 'websocket');
    });
  });
  
  // Function to broadcast to all connected WebSocket clients
  const broadcast = (message: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };
  
  // Schedule regular updates for WebSocket clients
  setInterval(async () => {
    try {
      const statusUpdate = {
        type: 'STATUS_UPDATE',
        data: discordBot.getStatus()
      };
      
      broadcast(statusUpdate);
    } catch (error) {
      console.error('Error broadcasting status update:', error);
    }
  }, 30000); // Every 30 seconds
  
  // Update countdowns and broadcast changes
  setInterval(async () => {
    try {
      await discordBot.updateCountdowns();
      
      // Get updated countdowns to broadcast
      const countdowns = await storage.getCountdowns();
      
      broadcast({
        type: 'COUNTDOWNS_UPDATE',
        data: countdowns
      });
    } catch (error) {
      console.error('Error updating countdowns:', error);
    }
  }, 60000); // Every minute
  
  return httpServer;
}
