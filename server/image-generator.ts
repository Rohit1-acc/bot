import { createCanvas, loadImage, registerFont, Canvas } from 'canvas';
import { AttachmentBuilder } from 'discord.js';
import { Points } from '../shared/schema';
import path from 'path';
import fs from 'fs';

// Constant values for the leaderboard image
const CANVAS_WIDTH = 800;
const BASE_HEIGHT = 250; // Base height (header, footer, etc.)
const USER_HEIGHT = 70;  // Height per user entry
const BACKGROUND_COLOR = '#2b2d31'; // Discord dark theme color
const TEXT_COLOR = '#ffffff';
const HEADER_COLOR = '#5865f2'; // Discord blurple
const GOLD_COLOR = '#ffd700';
const SILVER_COLOR = '#c0c0c0';
const BRONZE_COLOR = '#cd7f32';

// Function to create a leaderboard image
export async function createLeaderboardImage(
  leaderboardData: { user: { username: string; avatarUrl?: string | null }, amount: number }[], 
  serverIconUrl: string
): Promise<AttachmentBuilder> {
  // Calculate canvas height based on number of users
  const canvasHeight = BASE_HEIGHT + (leaderboardData.length * USER_HEIGHT);
  
  // Create canvas with calculated height
  const canvas = createCanvas(CANVAS_WIDTH, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // Add gradient overlay
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // Draw header
  ctx.fillStyle = HEADER_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 80);

  // Add rounded corners to the canvas
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.arcTo(0, 0, 10, 0, 10);
  ctx.arcTo(CANVAS_WIDTH, 0, CANVAS_WIDTH, 10, 10);
  ctx.arcTo(CANVAS_WIDTH, canvasHeight, CANVAS_WIDTH - 10, canvasHeight, 10);
  ctx.arcTo(0, canvasHeight, 0, canvasHeight - 10, 10);
  ctx.clip();

  try {
    // Load server icon (with fallback)
    let serverIcon;
    try {
      // Change the .webp extension to .png for better compatibility with canvas
      const fixedIconUrl = serverIconUrl.replace('.webp', '.png');
      serverIcon = await loadImage(fixedIconUrl);
    } catch (error) {
      console.error('Error loading server icon:', error);
      // Use a basic circle as fallback
      ctx.beginPath();
      ctx.arc(60, 40, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#5865f2';
      ctx.fill();
    }
    
    if (serverIcon) {
      // Draw server icon in a circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, 40, 30, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(serverIcon, 30, 10, 60, 60);
      ctx.restore();
    }

    // Draw title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Event Avengers Leaderboard', CANVAS_WIDTH / 2, 50);

    // Draw timestamp (smaller and repositioned)
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // Semi-transparent text
    ctx.fillText(`Updated: ${new Date().toLocaleString()}`, CANVAS_WIDTH - 20, 75);

    // Draw separator line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 100);
    ctx.lineTo(CANVAS_WIDTH - 30, 100);
    ctx.stroke();

    // Column headers
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('RANK', 50, 130);
    ctx.fillText('USER', 150, 130);
    ctx.fillText('POINTS', CANVAS_WIDTH - 150, 130);

    // Draw user entries
    let yPosition = 180;
    for (let i = 0; i < leaderboardData.length; i++) {
      const entry = leaderboardData[i];
      const rank = i + 1;
      
      // Background for alternate rows
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(30, yPosition - 30, CANVAS_WIDTH - 60, 60);
      }

      // Draw rank with medal for top 3
      ctx.textAlign = 'center';
      let rankColor = TEXT_COLOR;
      if (rank === 1) rankColor = GOLD_COLOR;
      if (rank === 2) rankColor = SILVER_COLOR;
      if (rank === 3) rankColor = BRONZE_COLOR;
      
      ctx.fillStyle = rankColor;
      ctx.font = 'bold 24px Arial';
      
      // Draw medal circle for top 3
      if (rank <= 3) {
        ctx.beginPath();
        ctx.arc(50, yPosition, 25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = rankColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      ctx.fillStyle = rankColor;
      ctx.fillText(`#${rank}`, 50, yPosition + 7);
      
      // Try to load user avatar (with fallback)
      let avatarUrl = entry.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.user.username)}&background=random`;
      // Change .webp to .png for better compatibility with canvas
      avatarUrl = avatarUrl.replace('.webp', '.png');
      try {
        const avatar = await loadImage(avatarUrl);
        // Draw avatar in a circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(120, yPosition, 20, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 100, yPosition - 20, 40, 40);
        ctx.restore();
      } catch (error) {
        console.error('Error loading avatar:', error);
        // Draw fallback avatar circle
        ctx.beginPath();
        ctx.arc(120, yPosition, 20, 0, Math.PI * 2);
        ctx.fillStyle = HEADER_COLOR;
        ctx.fill();
      }
      
      // Draw username
      ctx.textAlign = 'left';
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = '20px Arial';
      const username = entry.user.username.length > 20 
        ? entry.user.username.substring(0, 17) + '...' 
        : entry.user.username;
      ctx.fillText(username, 150, yPosition + 7);
      
      // Draw points
      ctx.textAlign = 'right';
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 20px Arial';
      ctx.fillText(entry.amount.toLocaleString(), CANVAS_WIDTH - 50, yPosition + 7);
      
      yPosition += 70;
    }

    // Draw footer
    ctx.fillStyle = 'rgba(88, 101, 242, 0.8)';
    ctx.fillRect(0, canvasHeight - 50, CANVAS_WIDTH, 50);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✧✦✧ Event Avengers Points v1.1 ✧✦✧', CANVAS_WIDTH / 2, canvasHeight - 20);

    // Convert canvas to PNG attachment
    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
  } catch (error) {
    console.error('Error generating leaderboard image:', error);
    
    // Create simple fallback image with error message
    const fallbackCanvas = createCanvas(CANVAS_WIDTH, 200);
    const fallbackCtx = fallbackCanvas.getContext('2d');
    
    fallbackCtx.fillStyle = BACKGROUND_COLOR;
    fallbackCtx.fillRect(0, 0, CANVAS_WIDTH, 200);
    
    fallbackCtx.fillStyle = '#ff3333';
    fallbackCtx.font = 'bold 24px Arial';
    fallbackCtx.textAlign = 'center';
    fallbackCtx.fillText('Error generating leaderboard image', CANVAS_WIDTH / 2, 80);
    
    fallbackCtx.fillStyle = TEXT_COLOR;
    fallbackCtx.font = '18px Arial';
    fallbackCtx.fillText('Please try again later', CANVAS_WIDTH / 2, 120);
    
    const fallbackBuffer = fallbackCanvas.toBuffer('image/png');
    return new AttachmentBuilder(fallbackBuffer, { name: 'leaderboard_error.png' });
  }
}