/**
 * External Keep-Alive Worker Script
 * 
 * This script helps maintain 24/7 uptime by sending regular pings
 * to the bot's health endpoints from a separate process.
 */

import { log } from './vite';
import fetch from 'node-fetch';

// Configuration
const CHECK_INTERVAL = 60 * 1000; // Check every minute
const ENDPOINTS = ['/ping', '/health', '/status']; // Rotate between these
const HOST = process.env.REPLIT_SLUG 
  ? `https://${process.env.REPLIT_SLUG}.${process.env.REPLIT_OWNER}.repl.co` 
  : 'http://localhost:5000';

async function pingEndpoint(endpoint: string): Promise<void> {
  const url = `${HOST}${endpoint}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { 
      signal: controller.signal, // Proper way to handle timeout
      headers: { 'User-Agent': 'KeepAliveWorker/1.0' }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      log(`Worker ping successful to ${endpoint}`, 'worker');
    } else {
      console.warn(`Worker received non-OK response (${response.status}) from ${endpoint}`);
    }
  } catch (error) {
    console.error(`Worker ping failed to ${endpoint}:`, error);
  }
}

// Start the worker process
log('Keep-alive worker started', 'worker');

// Keep track of which endpoint we're using
let currentEndpointIndex = 0;

// Ping endpoints sequentially with some randomness to avoid patterns
setInterval(() => {
  // Rotate through endpoints
  const endpoint = ENDPOINTS[currentEndpointIndex];
  currentEndpointIndex = (currentEndpointIndex + 1) % ENDPOINTS.length;
  
  // Add a small random delay to avoid exact timing patterns
  const randomDelay = Math.floor(Math.random() * 5000); // 0-5 seconds
  setTimeout(() => pingEndpoint(endpoint), randomDelay);
}, CHECK_INTERVAL);

// Set periodic console output to show it's still running
setInterval(() => {
  log('Keep-alive worker is running', 'worker');
}, 15 * 60 * 1000); // Every 15 minutes

// Prevent the process from exiting
process.on('uncaughtException', (error) => {
  console.error('Worker uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Worker unhandled rejection:', reason);
});