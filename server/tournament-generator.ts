import { createCanvas, loadImage, registerFont, Canvas } from 'canvas';
import { AttachmentBuilder } from 'discord.js';
import { Tournament, TournamentParticipant, TournamentMatchup } from '../shared/schema';
import path from 'path';
import fs from 'fs';

// Constants for the tournament bracket image
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const BACKGROUND_COLOR = '#2b2d31'; // Discord dark theme color
const TEXT_COLOR = '#ffffff';
const HEADER_COLOR = '#5865f2'; // Discord blurple
const MATCH_BG_COLOR = '#36393f'; // Discord darker theme
const MATCH_BORDER_COLOR = '#4e535a'; // Discord border color
const WINNER_COLOR = '#43b581'; // Discord green
const LOSER_COLOR = '#f04747'; // Discord red
const VS_COLOR = '#faa61a'; // Discord yellow

// Tournament bracket image generator
export async function createTournamentBracketImage(
  tournament: Tournament & { 
    participants: TournamentParticipant[],
    matchups: (TournamentMatchup & {
      participant1?: TournamentParticipant,
      participant2?: TournamentParticipant,
      winner?: TournamentParticipant,
      loser?: TournamentParticipant
    })[]
  },
  serverIconUrl: string
): Promise<AttachmentBuilder> {
  try {
    // Calculate canvas size based on tournament size
    const rounds = tournament.config?.rounds || 1;
    const canvasWidth = Math.max(CANVAS_WIDTH, rounds * 250 + 100); // Ensure enough width for all rounds
    const matchCount = tournament.matchups.length;
    const estimatedHeight = Math.max(CANVAS_HEIGHT, matchCount * 70 + 200); // Ensure enough height
    
    // Create canvas
    const canvas = createCanvas(canvasWidth, estimatedHeight);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvasWidth, estimatedHeight);
    
    // Add gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, 0, estimatedHeight);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, estimatedHeight);
    
    // Draw header
    ctx.fillStyle = HEADER_COLOR;
    ctx.fillRect(0, 0, canvasWidth, 80);
    
    // Add rounded corners
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.arcTo(0, 0, 10, 0, 10);
    ctx.arcTo(canvasWidth, 0, canvasWidth, 10, 10);
    ctx.arcTo(canvasWidth, estimatedHeight, canvasWidth - 10, estimatedHeight, 10);
    ctx.arcTo(0, estimatedHeight, 0, estimatedHeight - 10, 10);
    ctx.clip();
    
    // Load server icon (with fallback)
    let serverIcon;
    try {
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
    ctx.fillText(`${tournament.name} - ${tournament.game}`, canvasWidth / 2, 40);
    
    // Draw subtitle (type)
    ctx.font = '18px Arial';
    ctx.fillText(`${tournament.type.toUpperCase()} TOURNAMENT`, canvasWidth / 2, 65);
    
    // Draw timestamp
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(`Updated: ${new Date().toLocaleString()}`, canvasWidth - 20, 75);
    
    // Draw tournament description
    if (tournament.description) {
      ctx.textAlign = 'center';
      ctx.font = '16px Arial';
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(tournament.description, canvasWidth / 2, 120);
    }
    
    // Draw each round
    const matchWidth = 200;
    const matchHeight = 80;
    const roundSpacing = 250;
    const startX = 60;
    
    const matchPositions: Record<string, { x: number, y: number, width: number, height: number }> = {};
    
    // Group matchups by round
    const matchupsByRound: Record<number, TournamentMatchup[]> = {};
    
    for (const matchup of tournament.matchups) {
      if (!matchupsByRound[matchup.roundNumber]) {
        matchupsByRound[matchup.roundNumber] = [];
      }
      matchupsByRound[matchup.roundNumber].push(matchup);
    }
    
    // Calculate and store match positions
    for (let round = 1; round <= rounds; round++) {
      const roundMatches = matchupsByRound[round] || [];
      const matchesInRound = roundMatches.length;
      const roundX = startX + (round - 1) * roundSpacing;
      
      let startY = 180;
      const totalHeight = estimatedHeight - 280; // Subtract header and footer space
      const matchSpacing = totalHeight / (matchesInRound + 1);
      
      for (let i = 0; i < matchesInRound; i++) {
        const match = roundMatches[i];
        const matchY = startY + i * matchSpacing;
        
        matchPositions[`${match.roundNumber}-${match.matchNumber}`] = {
          x: roundX,
          y: matchY,
          width: matchWidth,
          height: matchHeight
        };
      }
    }
    
    // Draw connector lines between matches
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    
    for (let round = 2; round <= rounds; round++) {
      const roundMatches = matchupsByRound[round] || [];
      
      for (const match of roundMatches) {
        // Find the two previous round matches that feed into this one
        const prevRound = round - 1;
        const firstPrevMatch = match.matchNumber * 2 - 1;
        const secondPrevMatch = match.matchNumber * 2;
        
        const currentPos = matchPositions[`${round}-${match.matchNumber}`];
        const prevPos1 = matchPositions[`${prevRound}-${firstPrevMatch}`];
        const prevPos2 = matchPositions[`${prevRound}-${secondPrevMatch}`];
        
        if (currentPos && prevPos1) {
          // Draw line from first previous match to current
          ctx.beginPath();
          ctx.moveTo(prevPos1.x + prevPos1.width, prevPos1.y + prevPos1.height / 2);
          ctx.lineTo(prevPos1.x + prevPos1.width + roundSpacing / 3, prevPos1.y + prevPos1.height / 2);
          ctx.lineTo(prevPos1.x + prevPos1.width + roundSpacing / 3, currentPos.y + currentPos.height / 2);
          ctx.lineTo(currentPos.x, currentPos.y + currentPos.height / 2);
          ctx.stroke();
        }
        
        if (currentPos && prevPos2) {
          // Draw line from second previous match to current
          ctx.beginPath();
          ctx.moveTo(prevPos2.x + prevPos2.width, prevPos2.y + prevPos2.height / 2);
          ctx.lineTo(prevPos2.x + prevPos2.width + roundSpacing / 3, prevPos2.y + prevPos2.height / 2);
          ctx.lineTo(prevPos2.x + prevPos2.width + roundSpacing / 3, currentPos.y + currentPos.height / 2);
          ctx.lineTo(currentPos.x, currentPos.y + currentPos.height / 2);
          ctx.stroke();
        }
      }
    }
    
    // Draw round labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    
    for (let round = 1; round <= rounds; round++) {
      const roundX = startX + (round - 1) * roundSpacing + matchWidth / 2;
      let roundName = `Round ${round}`;
      
      if (round === 1) roundName = 'First Round';
      if (round === rounds) roundName = 'Final';
      if (round === rounds - 1 && rounds > 2) roundName = 'Semi-Final';
      if (round === rounds - 2 && rounds > 3) roundName = 'Quarter-Final';
      
      ctx.fillText(roundName, roundX, 160);
    }
    
    // Draw each match
    for (const match of tournament.matchups) {
      const pos = matchPositions[`${match.roundNumber}-${match.matchNumber}`];
      if (!pos) continue;
      
      // Draw match box
      ctx.fillStyle = MATCH_BG_COLOR;
      ctx.strokeStyle = MATCH_BORDER_COLOR;
      ctx.lineWidth = 2;
      
      // Rounded rectangle for match
      ctx.beginPath();
      ctx.moveTo(pos.x + 10, pos.y);
      ctx.lineTo(pos.x + pos.width - 10, pos.y);
      ctx.quadraticCurveTo(pos.x + pos.width, pos.y, pos.x + pos.width, pos.y + 10);
      ctx.lineTo(pos.x + pos.width, pos.y + pos.height - 10);
      ctx.quadraticCurveTo(pos.x + pos.width, pos.y + pos.height, pos.x + pos.width - 10, pos.y + pos.height);
      ctx.lineTo(pos.x + 10, pos.y + pos.height);
      ctx.quadraticCurveTo(pos.x, pos.y + pos.height, pos.x, pos.y + pos.height - 10);
      ctx.lineTo(pos.x, pos.y + 10);
      ctx.quadraticCurveTo(pos.x, pos.y, pos.x + 10, pos.y);
      ctx.fill();
      ctx.stroke();
      
      // Draw vs in center
      ctx.fillStyle = VS_COLOR;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('VS', pos.x + pos.width / 2, pos.y + pos.height / 2);
      
      // Draw match number
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px Arial';
      ctx.fillText(`Match ${match.matchNumber}`, pos.x + pos.width / 2, pos.y + 15);
      
      // Draw participant 1
      if (match.participant1) {
        ctx.fillStyle = match.winnerId === match.participant1Id ? WINNER_COLOR : 
                        match.loserId === match.participant1Id ? LOSER_COLOR : TEXT_COLOR;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        
        // Truncate long names
        const name1 = match.participant1.participantName.length > 16 
          ? match.participant1.participantName.substring(0, 13) + '...'
          : match.participant1.participantName;
        
        ctx.fillText(name1, pos.x + 10, pos.y + pos.height / 2 - 10);
        
        // Draw score if available
        if (match.score1 !== null && match.score1 !== undefined) {
          ctx.fillText(match.score1.toString(), pos.x + pos.width - 30, pos.y + pos.height / 2 - 10);
        }
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = 'italic 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('TBD', pos.x + 10, pos.y + pos.height / 2 - 10);
      }
      
      // Draw participant 2
      if (match.participant2) {
        ctx.fillStyle = match.winnerId === match.participant2Id ? WINNER_COLOR :
                        match.loserId === match.participant2Id ? LOSER_COLOR : TEXT_COLOR;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        
        // Truncate long names
        const name2 = match.participant2.participantName.length > 16
          ? match.participant2.participantName.substring(0, 13) + '...'
          : match.participant2.participantName;
        
        ctx.fillText(name2, pos.x + 10, pos.y + pos.height / 2 + 20);
        
        // Draw score if available
        if (match.score2 !== null && match.score2 !== undefined) {
          ctx.fillText(match.score2.toString(), pos.x + pos.width - 30, pos.y + pos.height / 2 + 20);
        }
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = 'italic 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('TBD', pos.x + 10, pos.y + pos.height / 2 + 20);
      }
      
      // Draw match status
      ctx.textAlign = 'center';
      ctx.font = '10px Arial';
      
      if (match.status === 'completed') {
        ctx.fillStyle = WINNER_COLOR;
        ctx.fillText('COMPLETED', pos.x + pos.width / 2, pos.y + pos.height - 10);
      } else if (match.status === 'in_progress') {
        ctx.fillStyle = VS_COLOR;
        ctx.fillText('IN PROGRESS', pos.x + pos.width / 2, pos.y + pos.height - 10);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText('PENDING', pos.x + pos.width / 2, pos.y + pos.height - 10);
      }
    }
    
    // Draw tournament status footer
    ctx.fillStyle = HEADER_COLOR;
    ctx.fillRect(0, estimatedHeight - 50, canvasWidth, 50);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Tournament Status: ${tournament.status.toUpperCase()}`, canvasWidth / 2, estimatedHeight - 20);
    
    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'tournament_bracket.png' });
  } catch (error) {
    console.error('Error generating tournament bracket image:', error);
    
    // Create fallback image with error message
    const fallbackCanvas = createCanvas(800, 200);
    const fallbackCtx = fallbackCanvas.getContext('2d');
    
    fallbackCtx.fillStyle = BACKGROUND_COLOR;
    fallbackCtx.fillRect(0, 0, 800, 200);
    
    fallbackCtx.fillStyle = LOSER_COLOR;
    fallbackCtx.font = 'bold 24px Arial';
    fallbackCtx.textAlign = 'center';
    fallbackCtx.fillText('Error generating tournament bracket image', 400, 80);
    
    fallbackCtx.fillStyle = TEXT_COLOR;
    fallbackCtx.font = '16px Arial';
    fallbackCtx.fillText('Please try again later', 400, 120);
    
    const fallbackBuffer = fallbackCanvas.toBuffer('image/png');
    return new AttachmentBuilder(fallbackBuffer, { name: 'tournament_error.png' });
  }
}

// Generate fixture/matchup image
export async function createMatchupImage(
  player1: string, 
  player2: string,
  avatar1?: string,
  avatar2?: string,
  gameTitle?: string,
  serverIconUrl?: string
): Promise<AttachmentBuilder> {
  try {
    // Create canvas
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, 800, 400);
    
    // Add gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, 800, 400);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 400);
    
    // Draw header
    ctx.fillStyle = HEADER_COLOR;
    ctx.fillRect(0, 0, 800, 60);
    
    // Round corners
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.arcTo(0, 0, 10, 0, 10);
    ctx.arcTo(800, 0, 800, 10, 10);
    ctx.arcTo(800, 400, 790, 400, 10);
    ctx.arcTo(0, 400, 0, 390, 10);
    ctx.clip();
    
    // Draw title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(gameTitle || 'MATCHUP', 400, 40);
    
    // Load avatars (with fallbacks)
    let avatar1Img = null;
    let avatar2Img = null;
    
    if (avatar1) {
      try {
        avatar1Img = await loadImage(avatar1);
      } catch (error) {
        console.error('Error loading avatar 1:', error);
      }
    }
    
    if (avatar2) {
      try {
        avatar2Img = await loadImage(avatar2);
      } catch (error) {
        console.error('Error loading avatar 2:', error);
      }
    }
    
    // Draw player 1 side (left)
    ctx.fillStyle = 'rgba(88, 101, 242, 0.3)'; // Discord blurple semi-transparent
    ctx.fillRect(0, 60, 350, 340);
    
    // Draw player 2 side (right)
    ctx.fillStyle = 'rgba(235, 69, 69, 0.3)'; // Discord red semi-transparent
    ctx.fillRect(450, 60, 350, 340);
    
    // Draw VS in the middle
    ctx.fillStyle = VS_COLOR;
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('VS', 400, 200);
    
    // Draw circle borders around VS
    ctx.strokeStyle = VS_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(400, 200, 70, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(400, 200, 80, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw player 1 avatar
    if (avatar1Img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(175, 160, 70, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar1Img, 105, 90, 140, 140);
      ctx.restore();
    } else {
      // Draw placeholder circle
      ctx.fillStyle = HEADER_COLOR;
      ctx.beginPath();
      ctx.arc(175, 160, 70, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw first letter of name
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 60px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player1.charAt(0).toUpperCase(), 175, 180);
    }
    
    // Draw player 2 avatar
    if (avatar2Img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(625, 160, 70, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar2Img, 555, 90, 140, 140);
      ctx.restore();
    } else {
      // Draw placeholder circle
      ctx.fillStyle = HEADER_COLOR;
      ctx.beginPath();
      ctx.arc(625, 160, 70, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw first letter of name
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 60px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player2.charAt(0).toUpperCase(), 625, 180);
    }
    
    // Draw player names
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player1, 175, 280);
    ctx.fillText(player2, 625, 280);
    
    // Draw footer
    ctx.fillStyle = 'rgba(43, 45, 49, 0.8)';
    ctx.fillRect(0, 350, 800, 50);
    
    // Draw timestamp
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Created: ${new Date().toLocaleString()}`, 780, 380);
    
    // Draw server icon if provided
    if (serverIconUrl) {
      try {
        const serverIcon = await loadImage(serverIconUrl.replace('.webp', '.png'));
        ctx.save();
        ctx.beginPath();
        ctx.arc(40, 375, 20, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(serverIcon, 20, 355, 40, 40);
        ctx.restore();
      } catch (error) {
        console.error('Error loading server icon:', error);
      }
    }
    
    // Convert to buffer and return
    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'matchup.png' });
  } catch (error) {
    console.error('Error generating matchup image:', error);
    
    // Create fallback image
    const fallbackCanvas = createCanvas(800, 200);
    const fallbackCtx = fallbackCanvas.getContext('2d');
    
    fallbackCtx.fillStyle = BACKGROUND_COLOR;
    fallbackCtx.fillRect(0, 0, 800, 200);
    
    fallbackCtx.fillStyle = LOSER_COLOR;
    fallbackCtx.font = 'bold 24px Arial';
    fallbackCtx.textAlign = 'center';
    fallbackCtx.fillText('Error generating matchup image', 400, 80);
    
    fallbackCtx.fillStyle = TEXT_COLOR;
    fallbackCtx.font = '16px Arial';
    fallbackCtx.fillText('Please try again later', 400, 120);
    
    const fallbackBuffer = fallbackCanvas.toBuffer('image/png');
    return new AttachmentBuilder(fallbackBuffer, { name: 'matchup_error.png' });
  }
}