import {
    getBalance,
    addMoney,
    removeMoney,
    transferMoney,
    claimDaily,
    getTopUsers,
    setBalance,
    canWork,
    updateLastWork,
    getUser,
    getUserStats,
    canClaimDaily,
    canFish,
    getFishInventory,
    getFishCollection,
    checkCollectionComplete,
    hasCollectionAchievement,
    getUserAchievements,
    hardResetUser,
    getPokemonCounts
} from '../database.js';
import { EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { FISH, RARITY_NAMES } from './fishing.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Register Pokemon font for profile
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
try {
    registerFont(join(__dirname, '../fonts/pokemon.ttf'), { family: 'Pokemon' });
} catch (e) {
    // Font already registered or not found
}

/**
 * Helper to draw rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Draw a coin icon
 */
function drawCoin(ctx, x, y, size) {
    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Inner detail
    ctx.beginPath();
    ctx.arc(x, y, size * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // $ symbol
    ctx.fillStyle = '#b8860b';
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', x, y);
}

/**
 * Draw a Pokeball icon
 */
function drawPokeball(ctx, x, y, size) {
    // Red top half
    ctx.beginPath();
    ctx.arc(x, y, size, Math.PI, 0);
    ctx.fillStyle = '#ff1a1a';
    ctx.fill();
    
    // White bottom half
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    
    // Black outline
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Center line
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Center button
    ctx.beginPath();
    ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.stroke();
}

/**
 * Draw a fish icon
 */
function drawFish(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#38b2ac';
    ctx.fill();
    
    // Tail
    ctx.beginPath();
    ctx.moveTo(size * 0.7, 0);
    ctx.lineTo(size * 1.3, -size * 0.5);
    ctx.lineTo(size * 1.3, size * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#38b2ac';
    ctx.fill();
    
    // Eye
    ctx.beginPath();
    ctx.arc(-size * 0.4, -size * 0.1, size * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-size * 0.4, -size * 0.1, size * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    
    ctx.restore();
}

/**
 * Draw a star icon
 */
function drawStar(ctx, x, y, size, color = '#ffd700') {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(angle) * size;
        const py = Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

/**
 * Draw a simple fishing hook icon
 */
function drawFishingHook(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    // Hook line
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size * 0.3);
    ctx.quadraticCurveTo(0, size * 0.8, -size * 0.4, size);
    ctx.quadraticCurveTo(-size * 0.7, size * 0.6, -size * 0.3, size * 0.3);
    ctx.stroke();
    
    // Hook point
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, size * 0.3);
    ctx.lineTo(-size * 0.15, size * 0.5);
    ctx.stroke();
    
    ctx.restore();
}

/**
 * Draw custom Janus currency symbol (Ɉ style with vertical bar)
 */
function drawJanusCurrency(ctx, x, y, size, color = '#f9e2af') {
    ctx.save();
    ctx.translate(x, y);
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size * 0.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const jStemX = size * 0.3; // Position of J vertical stem
    
    // J shape
    ctx.beginPath();
    ctx.moveTo(jStemX, -size * 0.8);
    ctx.lineTo(jStemX, size * 0.3);
    ctx.quadraticCurveTo(jStemX, size * 0.8, -size * 0.2, size * 0.8);
    ctx.quadraticCurveTo(-size * 0.5, size * 0.8, -size * 0.5, size * 0.4);
    ctx.stroke();
    
    // Vertical strike-through line (same X as J stem)
    ctx.beginPath();
    ctx.moveTo(jStemX, -size * 1.0);
    ctx.lineTo(jStemX, size * 1.0);
    ctx.stroke();
    
    // Top serif
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, -size * 0.8);
    ctx.lineTo(size * 0.6, -size * 0.8);
    ctx.stroke();
    
    ctx.restore();
}

/**
 * Generate profile card image - Clean Modern Style
 * Avatar on top-left with info on right, classic colors
 */
async function generateProfileImage(user, member, stats, pokemonStats, fishStats, cooldowns) {
    const width = 420;
    const height = 520;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // === MAIN BACKGROUND ===
    // Clean dark gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1e1e2e');
    bgGradient.addColorStop(1, '#181825');
    ctx.fillStyle = bgGradient;
    roundRect(ctx, 0, 0, width, height, 20);
    ctx.fill();
    
    // Subtle top accent line
    const accentGradient = ctx.createLinearGradient(0, 0, width, 0);
    accentGradient.addColorStop(0, '#89b4fa');
    accentGradient.addColorStop(0.5, '#cba6f7');
    accentGradient.addColorStop(1, '#89b4fa');
    roundRect(ctx, 0, 0, width, 4, 2);
    ctx.fillStyle = accentGradient;
    ctx.fill();
    
    // === HEADER SECTION (Avatar + Info) ===
    const headerY = 25;
    const avatarSize = 90;
    const avatarX = 30;
    const avatarCenterX = avatarX + avatarSize / 2;
    const avatarCenterY = headerY + avatarSize / 2;
    
    // Avatar border ring
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2 + 4, 0, Math.PI * 2);
    const ringGradient = ctx.createLinearGradient(avatarX, headerY, avatarX + avatarSize, headerY + avatarSize);
    ringGradient.addColorStop(0, '#89b4fa');
    ringGradient.addColorStop(1, '#cba6f7');
    ctx.strokeStyle = ringGradient;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Avatar image
    try {
        const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarURL);
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, headerY, avatarSize, avatarSize);
        ctx.restore();
    } catch (e) {
        ctx.beginPath();
        ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#313244';
        ctx.fill();
    }
    
    // === USER INFO (Right of avatar) ===
    const infoX = avatarX + avatarSize + 20;
    
    // Username
    ctx.fillStyle = '#cdd6f4';
    ctx.font = 'bold 24px "Pokemon", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(user.username, infoX, headerY + 28);
    
    // Member duration
    const joinDays = member?.joinedAt 
        ? Math.floor((new Date() - member.joinedAt) / (1000 * 60 * 60 * 24))
        : 0;
    
    ctx.fillStyle = '#a6adc8';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(`Membre depuis ${joinDays} jour${joinDays > 1 ? 's' : ''}`, infoX, headerY + 55);
    
    // Balance display (prominent) with custom currency symbol
    drawJanusCurrency(ctx, infoX + 10, headerY + 85, 12, '#f9e2af');
    ctx.fillStyle = '#f9e2af';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText(`${stats.balance.toLocaleString()}`, infoX + 28, headerY + 85);
    
    // === STATS CARDS ===
    const sectionStartY = 140;
    const cardWidth = width - 40;
    const cardHeight = 70;
    const cardSpacing = 8;
    const cardX = 20;
    
    // --- CARD 1: ECONOMY ---
    const card1Y = sectionStartY;
    
    roundRect(ctx, cardX, card1Y, cardWidth, cardHeight, 12);
    ctx.fillStyle = '#313244';
    ctx.fill();
    
    // Left accent
    roundRect(ctx, cardX, card1Y, 4, cardHeight, 2);
    ctx.fillStyle = '#a6e3a1';
    ctx.fill();
    
    // Coin icon
    drawCoin(ctx, cardX + 30, card1Y + cardHeight / 2, 14);
    
    // Title & Stats
    ctx.fillStyle = '#a6e3a1';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ÉCONOMIE', cardX + 55, card1Y + 20);
    
    ctx.fillStyle = '#9399b2';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText(`Total gagné: ${stats.totalEarned.toLocaleString()}`, cardX + 55, card1Y + 40);
    ctx.fillText(`Dépensé: ${stats.totalSpent.toLocaleString()}`, cardX + 55, card1Y + 55);
    
    // Right side - Net worth
    ctx.textAlign = 'right';
    ctx.fillStyle = '#a6e3a1';
    ctx.font = 'bold 20px Arial, sans-serif';
    const netWorth = stats.totalEarned - stats.totalSpent;
    ctx.fillText((netWorth >= 0 ? '+' : '') + netWorth.toLocaleString(), cardX + cardWidth - 15, card1Y + 35);
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = '#6c7086';
    ctx.fillText('bénéfice net', cardX + cardWidth - 15, card1Y + 52);
    
    // --- CARD 2: POKEMON ---
    const card2Y = card1Y + cardHeight + cardSpacing;
    
    roundRect(ctx, cardX, card2Y, cardWidth, cardHeight, 12);
    ctx.fillStyle = '#313244';
    ctx.fill();
    
    // Left accent
    roundRect(ctx, cardX, card2Y, 4, cardHeight, 2);
    ctx.fillStyle = '#f38ba8';
    ctx.fill();
    
    // Pokeball icon
    drawPokeball(ctx, cardX + 30, card2Y + cardHeight / 2, 13);
    
    // Title & Stats
    ctx.fillStyle = '#f38ba8';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('POKÉMON', cardX + 55, card2Y + 20);
    
    ctx.fillStyle = '#9399b2';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText(`Capturés: ${pokemonStats.total}`, cardX + 55, card2Y + 40);
    
    // Shiny count
    drawStar(ctx, cardX + 55 + 5, card2Y + 55, 5, '#f9e2af');
    ctx.fillStyle = '#f9e2af';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.fillText(`${pokemonStats.shiny} shiny`, cardX + 55 + 15, card2Y + 55);
    
    // Right side - Progress bar
    const pokemonProgress = Math.min(100, (pokemonStats.unique / 898) * 100);
    const progBarWidth = 90;
    const progBarHeight = 12;
    const progBarX = cardX + cardWidth - progBarWidth - 15;
    const progBarY = card2Y + 25;
    
    // Progress bar background
    roundRect(ctx, progBarX, progBarY, progBarWidth, progBarHeight, 6);
    ctx.fillStyle = '#45475a';
    ctx.fill();
    
    // Progress bar fill
    if (pokemonProgress > 0) {
        const fillWidth = Math.max(12, (pokemonProgress / 100) * progBarWidth);
        roundRect(ctx, progBarX, progBarY, fillWidth, progBarHeight, 6);
        ctx.fillStyle = '#f38ba8';
        ctx.fill();
    }
    
    // Progress text
    ctx.fillStyle = '#cdd6f4';
    ctx.font = 'bold 8px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${pokemonProgress.toFixed(1)}%`, progBarX + progBarWidth / 2, progBarY + progBarHeight / 2 + 1);
    
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6c7086';
    ctx.font = '10px Arial, sans-serif';
    ctx.fillText(`${pokemonStats.unique}/898 Pokédex`, cardX + cardWidth - 15, card2Y + 55);
    
    // --- CARD 3: FISHING ---
    const card3Y = card2Y + cardHeight + cardSpacing;
    const TOTAL_FISH_TYPES = 64; // Total fish species in the game
    
    roundRect(ctx, cardX, card3Y, cardWidth, cardHeight, 12);
    ctx.fillStyle = '#313244';
    ctx.fill();
    
    // Left accent
    roundRect(ctx, cardX, card3Y, 4, cardHeight, 2);
    ctx.fillStyle = '#89b4fa';
    ctx.fill();
    
    // Fishing hook icon
    drawFishingHook(ctx, cardX + 30, card3Y + cardHeight / 2, 12);
    
    // Title & Stats
    ctx.fillStyle = '#89b4fa';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PÊCHE', cardX + 55, card3Y + 20);
    
    ctx.fillStyle = '#9399b2';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText(`Poissons pêchés: ${fishStats.totalFish}`, cardX + 55, card3Y + 40);
    
    // Collection achievement text
    const fishCollectionComplete = fishStats.uniqueTypes >= TOTAL_FISH_TYPES;
    if (fishCollectionComplete) {
        ctx.fillStyle = '#f9e2af';
        ctx.font = 'bold 11px Arial, sans-serif';
        drawStar(ctx, cardX + 55 + 5, card3Y + 55, 5, '#f9e2af');
        ctx.fillText('Collection complète!', cardX + 55 + 15, card3Y + 55);
    } else {
        ctx.fillStyle = '#6c7086';
        ctx.font = '11px Arial, sans-serif';
        ctx.fillText(`${TOTAL_FISH_TYPES - fishStats.uniqueTypes} espèces restantes`, cardX + 55, card3Y + 55);
    }
    
    // Right side - Collection progress
    const fishProgress = Math.min(100, (fishStats.uniqueTypes / TOTAL_FISH_TYPES) * 100);
    const fishProgBarX = cardX + cardWidth - progBarWidth - 15;
    const fishProgBarY = card3Y + 25;
    
    // Progress bar background
    roundRect(ctx, fishProgBarX, fishProgBarY, progBarWidth, progBarHeight, 6);
    ctx.fillStyle = '#45475a';
    ctx.fill();
    
    // Progress bar fill
    if (fishProgress > 0) {
        const fillWidth = Math.max(12, (fishProgress / 100) * progBarWidth);
        roundRect(ctx, fishProgBarX, fishProgBarY, fillWidth, progBarHeight, 6);
        ctx.fillStyle = '#89b4fa';
        ctx.fill();
    }
    
    // Progress text
    ctx.fillStyle = '#cdd6f4';
    ctx.font = 'bold 8px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${fishProgress.toFixed(1)}%`, fishProgBarX + progBarWidth / 2, fishProgBarY + progBarHeight / 2 + 1);
    
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6c7086';
    ctx.font = '10px Arial, sans-serif';
    ctx.fillText(`${fishStats.uniqueTypes}/${TOTAL_FISH_TYPES} Collection`, cardX + cardWidth - 15, card3Y + 55);
    
    // --- CARD 4: COOLDOWNS ---
    const card4Y = card3Y + cardHeight + cardSpacing;
    
    roundRect(ctx, cardX, card4Y, cardWidth, cardHeight, 12);
    ctx.fillStyle = '#313244';
    ctx.fill();
    
    // Left accent
    roundRect(ctx, cardX, card4Y, 4, cardHeight, 2);
    ctx.fillStyle = '#cba6f7';
    ctx.fill();
    
    // Title
    ctx.fillStyle = '#cba6f7';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('COOLDOWNS', cardX + 20, card4Y + 18);
    
    // Cooldown indicators
    const cooldownItems = [
        { name: 'Daily', ready: cooldowns.daily },
        { name: 'Work', ready: cooldowns.work },
        { name: 'Fish', ready: cooldowns.fish }
    ];
    
    const indicatorWidth = (cardWidth - 50) / 3;
    const indicatorY = card4Y + 38;
    
    cooldownItems.forEach((item, i) => {
        const indX = cardX + 20 + i * (indicatorWidth + 5);
        const isReady = item.ready;
        const readyColor = '#a6e3a1';
        const notReadyColor = '#ff4757'; // Rouge vif
        
        // Background pill
        roundRect(ctx, indX, indicatorY, indicatorWidth - 5, 24, 12);
        ctx.fillStyle = isReady ? 'rgba(166, 227, 161, 0.2)' : 'rgba(255, 71, 87, 0.2)';
        ctx.fill();
        
        // Border
        ctx.strokeStyle = isReady ? readyColor : notReadyColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Status dot on left
        ctx.beginPath();
        ctx.arc(indX + 12, indicatorY + 12, 4, 0, Math.PI * 2);
        ctx.fillStyle = isReady ? readyColor : notReadyColor;
        ctx.fill();
        
        // Text
        ctx.fillStyle = isReady ? readyColor : notReadyColor;
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.name, indX + (indicatorWidth - 5) / 2 + 8, indicatorY + 13);
    });
    
    // === OUTER BORDER ===
    roundRect(ctx, 2, 2, width - 4, height - 4, 18);
    ctx.strokeStyle = '#45475a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    return canvas.toBuffer('image/png');
}

/**
 * Generate achievements image
 */
async function generateAchievementsImage(user, collectionCheck, fishByRarity, totalByRarity, hasCollection) {
    const width = 420;
    const height = 480;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1e1e2e');
    bgGradient.addColorStop(1, '#181825');
    ctx.fillStyle = bgGradient;
    roundRect(ctx, 0, 0, width, height, 20);
    ctx.fill();
    
    // Top accent (gold if complete, blue otherwise)
    const accentColor = hasCollection ? '#f9e2af' : '#89b4fa';
    roundRect(ctx, 0, 0, width, 4, 2);
    ctx.fillStyle = accentColor;
    ctx.fill();
    
    // Title
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ACHIEVEMENTS', width / 2, 40);
    
    // User info
    ctx.fillStyle = '#cdd6f4';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(user.username, width / 2, 65);
    
    // Collection status card
    const cardX = 20;
    const cardY = 90;
    const cardWidth = width - 40;
    
    roundRect(ctx, cardX, cardY, cardWidth, 70, 12);
    ctx.fillStyle = '#313244';
    ctx.fill();
    
    // Left accent
    roundRect(ctx, cardX, cardY, 4, 70, 2);
    ctx.fillStyle = hasCollection ? '#f9e2af' : '#89b4fa';
    ctx.fill();
    
    // Collection title
    ctx.fillStyle = hasCollection ? '#f9e2af' : '#89b4fa';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('COLLECTION COMPLÈTE', cardX + 20, cardY + 25);
    
    if (hasCollection) {
        ctx.fillStyle = '#a6e3a1';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillText('COMPLÉTÉE !', cardX + 20, cardY + 50);
        
        // Trophy icon
        drawStar(ctx, cardX + cardWidth - 30, cardY + 35, 15, '#f9e2af');
    } else {
        // Progress bar
        const progress = (collectionCheck.collected / collectionCheck.total) * 100;
        const progBarWidth = 200;
        const progBarX = cardX + 20;
        const progBarY = cardY + 42;
        
        roundRect(ctx, progBarX, progBarY, progBarWidth, 16, 8);
        ctx.fillStyle = '#45475a';
        ctx.fill();
        
        if (progress > 0) {
            const fillWidth = Math.max(16, (progress / 100) * progBarWidth);
            roundRect(ctx, progBarX, progBarY, fillWidth, 16, 8);
            ctx.fillStyle = '#89b4fa';
            ctx.fill();
        }
        
        ctx.fillStyle = '#cdd6f4';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${collectionCheck.collected}/${collectionCheck.total}`, progBarX + progBarWidth / 2, progBarY + 11);
        
        // Remaining count
        ctx.textAlign = 'right';
        ctx.fillStyle = '#6c7086';
        ctx.font = '12px Arial, sans-serif';
        ctx.fillText(`${collectionCheck.total - collectionCheck.collected} restants`, cardX + cardWidth - 15, progBarY + 11);
    }
    
    // Rarity breakdown
    const rarityY = 180;
    ctx.fillStyle = '#cba6f7';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PROGRESSION PAR RARETÉ', cardX, rarityY);
    
    const rarities = [
        { name: 'Commun', key: 'common', color: '#9399b2' },
        { name: 'Peu Commun', key: 'uncommon', color: '#a6e3a1' },
        { name: 'Rare', key: 'rare', color: '#89b4fa' },
        { name: 'Épique', key: 'epic', color: '#cba6f7' },
        { name: 'Légendaire', key: 'legendary', color: '#fab387' },
        { name: 'Mythique', key: 'mythic', color: '#f9e2af' }
    ];
    
    rarities.forEach((rarity, i) => {
        const rowY = rarityY + 30 + i * 42;
        const collected = fishByRarity[rarity.key] || 0;
        const total = totalByRarity[rarity.key] || 0;
        const progress = total > 0 ? (collected / total) * 100 : 0;
        const isComplete = collected >= total;
        
        // Row background
        roundRect(ctx, cardX, rowY, cardWidth, 36, 8);
        ctx.fillStyle = '#313244';
        ctx.fill();
        
        // Colored dot
        ctx.beginPath();
        ctx.arc(cardX + 18, rowY + 18, 6, 0, Math.PI * 2);
        ctx.fillStyle = rarity.color;
        ctx.fill();
        
        // Rarity name
        ctx.fillStyle = '#cdd6f4';
        ctx.font = '12px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(rarity.name, cardX + 35, rowY + 22);
        
        // Progress bar
        const barX = cardX + 140;
        const barWidth = 150;
        
        roundRect(ctx, barX, rowY + 12, barWidth, 12, 6);
        ctx.fillStyle = '#45475a';
        ctx.fill();
        
        if (progress > 0) {
            const fillWidth = Math.max(12, (progress / 100) * barWidth);
            roundRect(ctx, barX, rowY + 12, fillWidth, 12, 6);
            ctx.fillStyle = isComplete ? '#a6e3a1' : rarity.color;
            ctx.fill();
        }
        
        // Count
        ctx.fillStyle = isComplete ? '#a6e3a1' : '#9399b2';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${collected}/${total}`, cardX + cardWidth - 10, rowY + 22);
    });
    
    // Outer border
    roundRect(ctx, 2, 2, width - 4, height - 4, 18);
    ctx.strokeStyle = '#45475a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    return canvas.toBuffer('image/png');
}

/**
 * Generate fish collection image
 */
async function generateFishCollectionImage(user, inventory, collection) {
    const width = 420;
    const height = 520;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1e1e2e');
    bgGradient.addColorStop(1, '#181825');
    ctx.fillStyle = bgGradient;
    roundRect(ctx, 0, 0, width, height, 20);
    ctx.fill();
    
    // Top accent
    roundRect(ctx, 0, 0, width, 4, 2);
    ctx.fillStyle = '#89b4fa';
    ctx.fill();
    
    // Title
    ctx.fillStyle = '#89b4fa';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('INVENTAIRE PÊCHE', width / 2, 40);
    
    // User info
    ctx.fillStyle = '#cdd6f4';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(user.username, width / 2, 65);
    
    const fishEntries = Object.entries(inventory).filter(([_, qty]) => qty > 0);
    
    if (fishEntries.length === 0) {
        ctx.fillStyle = '#6c7086';
        ctx.font = '16px Arial, sans-serif';
        ctx.fillText('Inventaire vide', width / 2, height / 2);
        ctx.font = '12px Arial, sans-serif';
        ctx.fillText('Utilisez $fish pour pêcher !', width / 2, height / 2 + 25);
    } else {
        // Sort by rarity then quantity
        const rarityOrder = { mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
        fishEntries.sort((a, b) => {
            const rarityA = FISH[a[0]]?.rarity || 'common';
            const rarityB = FISH[b[0]]?.rarity || 'common';
            if (rarityOrder[rarityA] !== rarityOrder[rarityB]) {
                return rarityOrder[rarityA] - rarityOrder[rarityB];
            }
            return b[1] - a[1];
        });
        
        // Calculate total value
        let totalValue = 0;
        fishEntries.forEach(([name, qty]) => {
            if (FISH[name]) totalValue += FISH[name].price * qty;
        });
        
        // Summary card
        const summaryY = 85;
        roundRect(ctx, 20, summaryY, width - 40, 50, 12);
        ctx.fillStyle = '#313244';
        ctx.fill();
        
        ctx.fillStyle = '#cdd6f4';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${fishEntries.length} types`, 35, summaryY + 22);
        
        ctx.fillStyle = '#6c7086';
        ctx.font = '11px Arial, sans-serif';
        ctx.fillText(`${fishEntries.reduce((acc, [_, qty]) => acc + qty, 0)} poissons`, 35, summaryY + 38);
        
        // Total value with Janus symbol
        ctx.textAlign = 'right';
        drawJanusCurrency(ctx, width - 120, summaryY + 28, 10, '#f9e2af');
        ctx.fillStyle = '#f9e2af';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillText(totalValue.toLocaleString(), width - 35, summaryY + 30);
        
        // Fish list
        const listY = 150;
        const itemHeight = 32;
        const maxItems = Math.min(fishEntries.length, 10);
        
        const rarityColors = {
            common: '#9399b2',
            uncommon: '#a6e3a1',
            rare: '#89b4fa',
            epic: '#cba6f7',
            legendary: '#fab387',
            mythic: '#f9e2af'
        };
        
        fishEntries.slice(0, maxItems).forEach(([fishName, quantity], i) => {
            const fish = FISH[fishName];
            const rowY = listY + i * itemHeight;
            const rarity = fish?.rarity || 'common';
            const price = fish?.price || 0;
            
            // Row background (alternating)
            if (i % 2 === 0) {
                roundRect(ctx, 20, rowY, width - 40, itemHeight - 2, 6);
                ctx.fillStyle = 'rgba(49, 50, 68, 0.5)';
                ctx.fill();
            }
            
            // Rarity indicator
            ctx.beginPath();
            ctx.arc(35, rowY + itemHeight / 2 - 1, 5, 0, Math.PI * 2);
            ctx.fillStyle = rarityColors[rarity];
            ctx.fill();
            
            // Fish name
            ctx.fillStyle = '#cdd6f4';
            ctx.font = '12px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(fishName, 50, rowY + itemHeight / 2 + 2);
            
            // Quantity
            ctx.fillStyle = '#a6adc8';
            ctx.font = 'bold 12px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`x${quantity}`, width - 100, rowY + itemHeight / 2 + 2);
            
            // Value
            ctx.fillStyle = '#f9e2af';
            ctx.textAlign = 'right';
            ctx.fillText((price * quantity).toLocaleString(), width - 30, rowY + itemHeight / 2 + 2);
        });
        
        // Show more indicator
        if (fishEntries.length > maxItems) {
            ctx.fillStyle = '#6c7086';
            ctx.font = '11px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`... et ${fishEntries.length - maxItems} autres types`, width / 2, listY + maxItems * itemHeight + 15);
        }
        
        // Sell hint
        ctx.fillStyle = '#6c7086';
        ctx.font = '11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$sellfish [nom] [qté] pour vendre', width / 2, height - 25);
    }
    
    // Outer border
    roundRect(ctx, 2, 2, width - 4, height - 4, 18);
    ctx.strokeStyle = '#45475a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    return canvas.toBuffer('image/png');
}

/**
 * Balance command - Check user's balance
 */
export async function balanceCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const balance = await getBalance(userId, guildId);
    
    const embed = new EmbedBuilder()
        .setTitle('💰 Solde')
        .setDescription(`**${message.author.username}**, vous avez **${balance.toLocaleString()}** coins !`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Daily command - Claim daily reward
 */
export async function dailyCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const result = await claimDaily(userId, guildId, 500);
    
    const embed = new EmbedBuilder()
        .setTitle(result.success ? '🎁 Récompense Quotidienne Réclamée !' : '⏰ Récompense Quotidienne')
        .setDescription(result.message)
        .setColor(result.success ? 0x00ff00 : 0xff0000)
        .setTimestamp();
    
    // Add streak info to footer if available
    if (result.streak !== undefined) {
        if (result.success && result.streak > 0) {
            embed.setFooter({ text: `🔥 Streak: ${result.streak} jour${result.streak > 1 ? 's' : ''} consécutif${result.streak > 1 ? 's' : ''}` });
        } else if (!result.success) {
            embed.setFooter({ text: `📊 Streak actuel: ${result.streak} jour${result.streak > 1 ? 's' : ''}` });
        }
    }
    
    await message.reply({ embeds: [embed] });
}

/**
 * Work command - Earn money by working (5 hour cooldown)
 */
export async function workCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!(await canWork(userId, guildId))) {
        const user = await getUser(userId, guildId);
        const lastWork = new Date(user.last_work);
        const nextWork = new Date(lastWork.getTime() + 5 * 60 * 60 * 1000);
        const hoursLeft = ((nextWork - new Date()) / (1000 * 60 * 60)).toFixed(1);
        
        const embed = new EmbedBuilder()
            .setTitle('⏰ Temps d\'attente')
            .setDescription(`Vous avez déjà travaillé récemment ! Revenez dans **${hoursLeft}** heures.`)
            .setColor(0xff0000)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Random reward between 100-500 coins
    const reward = Math.floor(Math.random() * 401) + 100;
    const newBalance = await addMoney(userId, guildId, reward, 'work', 'Worked hard');
    await updateLastWork(userId, guildId);
    
    const embed = new EmbedBuilder()
        .setTitle('💼 Travail Terminé !')
        .setDescription(`Vous avez travaillé dur et gagné **${reward.toLocaleString()}** coins !\nVotre nouveau solde est de **${newBalance.toLocaleString()}** coins.\n\n⏰ Prochain travail disponible dans 5 heures.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Give command - Give money to another user
 * Usage: $give @user <amount>
 */
export async function giveCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length < 2) {
        await message.reply('❌ Utilisation : `$give @user <montant>`');
        return;
    }
    
    // Parse user mention
    const userMatch = args[0].match(/^<@!?(\d+)>$/);
    if (!userMatch) {
        await message.reply('❌ Veuillez mentionner un utilisateur valide ! Utilisation : `$give @user <montant>`');
        return;
    }
    
    const targetUserId = userMatch[1];
    const targetUser = await message.guild.members.fetch(targetUserId).catch(() => null);
    
    if (!targetUser) {
        await message.reply('❌ Utilisateur introuvable !');
        return;
    }
    
    if (targetUser.user.bot) {
        await message.reply('❌ Vous ne pouvez pas donner de l\'argent aux bots !');
        return;
    }
    
    if (targetUserId === userId) {
        await message.reply('❌ Vous ne pouvez pas vous donner de l\'argent à vous-même !');
        return;
    }
    
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
        await message.reply('❌ Veuillez fournir un montant valide supérieur à 0 !');
        return;
    }
    
    const success = await transferMoney(userId, targetUserId, guildId, amount);
    
    if (!success) {
        const balance = await getBalance(userId, guildId);
        await message.reply(`❌ Fonds insuffisants ! Vous avez **${balance.toLocaleString()}** coins.`);
        return;
    }
    
    const balance = await getBalance(userId, guildId);
    const embed = new EmbedBuilder()
        .setTitle('💸 Argent Transféré !')
        .setDescription(`Vous avez donné **${amount.toLocaleString()}** coins à ${targetUser.user.username} !\nVotre nouveau solde est de **${balance.toLocaleString()}** coins.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Leaderboard command - Show top users by balance
 */
export async function leaderboardCommand(message) {
    const guildId = message.guild.id;
    const topUsers = await getTopUsers(guildId, 10);
    
    if (topUsers.length === 0) {
        await message.reply('❌ Aucun utilisateur trouvé dans le système d\'économie !');
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🏆 Classement Économique')
        .setDescription(
            topUsers.map((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                return `${medal} <@${user.user_id}> - **${user.balance.toLocaleString()}** coins`;
            }).join('\n')
        )
        .setColor(0xffd700)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Admin: Set balance command
 * Usage: $setbalance @user <amount>
 */
export async function setBalanceCommand(message, args) {
    // Restrict command to specific user ID only
    const AUTHORIZED_USER_ID = '581419256621826089';
    
    if (message.author.id !== AUTHORIZED_USER_ID) {
        await message.reply('❌ Cette commande est réservée au propriétaire du bot uniquement.');
        return;
    }
    
    if (args.length < 2) {
        await message.reply('❌ Utilisation : `$setbalance @user <montant>`');
        return;
    }
    
    // Parse user mention
    const userMatch = args[0].match(/^<@!?(\d+)>$/);
    if (!userMatch) {
        await message.reply('❌ Veuillez mentionner un utilisateur valide ! Utilisation : `$setbalance @user <montant>`');
        return;
    }
    
    const targetUserId = userMatch[1];
    const targetUser = await message.guild.members.fetch(targetUserId).catch(() => null);
    
    if (!targetUser) {
        await message.reply('❌ Utilisateur introuvable !');
        return;
    }
    
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 0) {
        await message.reply('❌ Veuillez fournir un montant valide (0 ou supérieur) !');
        return;
    }
    
    const guildId = message.guild.id;
    await setBalance(targetUserId, guildId, amount);
    
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Solde Défini')
        .setDescription(`Le solde de ${targetUser.user.username} a été défini à **${amount.toLocaleString()}** coins.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Admin: Add money command
 * Usage: $addmoney @user <amount>
 */
export async function addMoneyCommand(message, args) {
    // Restrict command to specific user ID only
    const AUTHORIZED_USER_ID = '581419256621826089';
    
    if (message.author.id !== AUTHORIZED_USER_ID) {
        await message.reply('❌ Cette commande est réservée au propriétaire du bot uniquement.');
        return;
    }
    
    if (args.length < 2) {
        await message.reply('❌ Utilisation : `$addmoney @user <montant>`');
        return;
    }
    
    // Parse user mention
    const userMatch = args[0].match(/^<@!?(\d+)>$/);
    if (!userMatch) {
        await message.reply('❌ Veuillez mentionner un utilisateur valide ! Utilisation : `$addmoney @user <montant>`');
        return;
    }
    
    const targetUserId = userMatch[1];
    const targetUser = await message.guild.members.fetch(targetUserId).catch(() => null);
    
    if (!targetUser) {
        await message.reply('❌ Utilisateur introuvable !');
        return;
    }
    
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
        await message.reply('❌ Veuillez fournir un montant valide supérieur à 0 !');
        return;
    }
    
    const guildId = message.guild.id;
    const newBalance = await addMoney(targetUserId, guildId, amount, 'admin', `Admin a ajouté ${amount} coins`);
    
    const embed = new EmbedBuilder()
        .setTitle('➕ Argent Ajouté')
        .setDescription(`**${amount.toLocaleString()}** coins ont été ajoutés à ${targetUser.user.username} !\nNouveau solde : **${newBalance.toLocaleString()}** coins.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Hard reset command - Reset all user data to default (OWNER ONLY)
 * Usage: $hardreset @user
 */
export async function hardResetCommand(message, args) {
    // Restrict command to specific user ID only
    const AUTHORIZED_USER_ID = '581419256621826089';
    
    if (message.author.id !== AUTHORIZED_USER_ID) {
        await message.reply('❌ Cette commande est réservée au propriétaire du bot uniquement.');
        return;
    }
    
    if (args.length < 1) {
        await message.reply('❌ Utilisation : `$hardreset @user`\n⚠️ **ATTENTION:** Cette commande réinitialise TOUTES les données de l\'utilisateur (balance, inventaire, achievements, transactions, etc.)');
        return;
    }
    
    // Parse user mention
    const userMatch = args[0].match(/^<@!?(\d+)>$/);
    if (!userMatch) {
        await message.reply('❌ Veuillez mentionner un utilisateur valide ! Utilisation : `$hardreset @user`');
        return;
    }
    
    const targetUserId = userMatch[1];
    const targetUser = await message.guild.members.fetch(targetUserId).catch(() => null);
    
    if (!targetUser) {
        await message.reply('❌ Utilisateur introuvable !');
        return;
    }
    
    if (targetUser.user.bot) {
        await message.reply('❌ Vous ne pouvez pas réinitialiser les données d\'un bot !');
        return;
    }
    
    const guildId = message.guild.id;
    
    // Perform the reset
    const result = await hardResetUser(targetUserId, guildId);
    
    if (result.success) {
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Réinitialisation Complète')
            .setDescription(
                `Toutes les données de **${targetUser.user.username}** ont été réinitialisées avec succès.\n\n` +
                `✅ Solde réinitialisé à **1000 coins**\n` +
                `✅ Inventaire vidé\n` +
                `✅ Collection vidée\n` +
                `✅ Achievements réinitialisés\n` +
                `✅ Transactions supprimées\n` +
                `✅ Cooldowns réinitialisés\n` +
                `✅ Streak daily réinitialisé\n\n` +
                `**L'utilisateur repart de zéro.**`
            )
            .setColor(0x00ff00)
            .setTimestamp();
        
        await message.reply({ embeds: [successEmbed] });
    } else {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Erreur de Réinitialisation')
            .setDescription(`Une erreur est survenue : ${result.message}`)
            .setColor(0xff0000)
            .setTimestamp();
        
        await message.reply({ embeds: [errorEmbed] });
    }
}

/**
 * Profile command - Show user profile with statistics (image version)
 */
export async function profileCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Show loading
    const loadingMsg = await message.reply('🔄 Génération du profil...');
    
    try {
        const stats = await getUserStats(userId, guildId);
        
        // Calculate fish inventory value
        let inventoryValue = 0;
        const inventory = await getFishInventory(userId, guildId);
        const fishEntries = Object.entries(inventory);
        
        for (const [fishName, quantity] of fishEntries) {
            if (FISH[fishName]) {
                inventoryValue += FISH[fishName].price * quantity;
            }
        }
        
        // Get cooldown status
        const dailyAvailable = await canClaimDaily(userId, guildId);
        const workAvailable = await canWork(userId, guildId);
        const fishCheck = await canFish(userId, guildId);
        const fishAvailable = fishCheck.canFish;
        
        // Get Pokemon stats
        let pokemonStats = { unique: 0, total: 0, shiny: 0 };
        try {
            pokemonStats = await getPokemonCounts(userId, guildId);
        } catch (e) {
            // Pokemon stats might not be available
        }
        
        // Get member
        let member = null;
        try {
            member = await message.guild.members.fetch(userId);
        } catch (e) {
            // Member might not be in cache
        }
        
        // Prepare data for image generation
        const fishStats = {
            totalFish: stats.totalFish,
            uniqueTypes: stats.uniqueFishTypes,
            inventoryValue: inventoryValue
        };
        
        const cooldowns = {
            daily: dailyAvailable,
            work: workAvailable,
            fish: fishAvailable
        };
        
        // Generate profile image
        const imageBuffer = await generateProfileImage(
            message.author,
            member,
            stats,
            pokemonStats,
            fishStats,
            cooldowns
        );
        
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });
        
        // Create buttons
        const fishButton = new ButtonBuilder()
            .setCustomId(`profile_fish_${userId}`)
            .setLabel('Collection')
            .setStyle(ButtonStyle.Primary);
        
        const achievementsButton = new ButtonBuilder()
            .setCustomId(`profile_achievements_${userId}`)
            .setLabel('Achievements')
            .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder().addComponents(fishButton, achievementsButton);
        
        const embed = new EmbedBuilder()
            .setColor(0xe94560)
            .setImage('attachment://profile.png');
        
        await loadingMsg.edit({ content: null, embeds: [embed], files: [attachment], components: [row] });
    } catch (error) {
        console.error('Error generating profile image:', error);
        await loadingMsg.edit('❌ Erreur lors de la génération du profil.').catch(() => {});
    }
}

/**
 * Handle profile button interactions
 */
export async function handleProfileButton(interaction) {
    const customId = interaction.customId;
    const userId = customId.split('_')[2];
    
    // Only allow the user who owns the profile to interact
    if (interaction.user.id !== userId) {
        await interaction.reply({ content: 'Ce n\'est pas votre profil !', ephemeral: true });
        return;
    }
    
    await interaction.deferUpdate();
    
    try {
        const guildId = interaction.guild.id;
        const user = interaction.user;
        
        if (customId.startsWith('profile_fish_')) {
            // Generate fish collection image
            const inventory = await getFishInventory(userId, guildId);
            const collection = await getFishCollection(userId, guildId);
            
            const imageBuffer = await generateFishCollectionImage(user, inventory, collection);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'fish.png' });
            
            // Back button
            const backButton = new ButtonBuilder()
                .setCustomId(`profile_back_${userId}`)
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary);
            
            const row = new ActionRowBuilder().addComponents(backButton);
            
            const embed = new EmbedBuilder()
                .setColor(0x89b4fa)
                .setImage('attachment://fish.png');
            
            await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
            
        } else if (customId.startsWith('profile_achievements_')) {
            // Generate achievements image
            const collectionCheck = await checkCollectionComplete(userId, guildId, FISH);
            const hasCollection = await hasCollectionAchievement(userId, guildId);
            const collection = await getFishCollection(userId, guildId);
            
            const fishByRarity = {
                common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0
            };
            
            Object.keys(collection).forEach((fishName) => {
                if (collection[fishName] === true && FISH[fishName]) {
                    fishByRarity[FISH[fishName].rarity] = (fishByRarity[FISH[fishName].rarity] || 0) + 1;
                }
            });
            
            const totalByRarity = {
                common: Object.values(FISH).filter(f => f.rarity === 'common').length,
                uncommon: Object.values(FISH).filter(f => f.rarity === 'uncommon').length,
                rare: Object.values(FISH).filter(f => f.rarity === 'rare').length,
                epic: Object.values(FISH).filter(f => f.rarity === 'epic').length,
                legendary: Object.values(FISH).filter(f => f.rarity === 'legendary').length,
                mythic: Object.values(FISH).filter(f => f.rarity === 'mythic').length
            };
            
            const imageBuffer = await generateAchievementsImage(user, collectionCheck, fishByRarity, totalByRarity, hasCollection);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'achievements.png' });
            
            // Back button
            const backButton = new ButtonBuilder()
                .setCustomId(`profile_back_${userId}`)
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary);
            
            const row = new ActionRowBuilder().addComponents(backButton);
            
            const embed = new EmbedBuilder()
                .setColor(hasCollection ? 0xf9e2af : 0x89b4fa)
                .setImage('attachment://achievements.png');
            
            await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
            
        } else if (customId.startsWith('profile_back_')) {
            // Regenerate profile
            const stats = await getUserStats(userId, guildId);
            
            let inventoryValue = 0;
            const inventory = await getFishInventory(userId, guildId);
            for (const [fishName, quantity] of Object.entries(inventory)) {
                if (FISH[fishName]) {
                    inventoryValue += FISH[fishName].price * quantity;
                }
            }
            
            const dailyAvailable = await canClaimDaily(userId, guildId);
            const workAvailable = await canWork(userId, guildId);
            const fishCheck = await canFish(userId, guildId);
            const fishAvailable = fishCheck.canFish;
            
            let pokemonStats = { unique: 0, total: 0, shiny: 0 };
            try {
                pokemonStats = await getPokemonCounts(userId, guildId);
            } catch (e) {}
            
            let member = null;
            try {
                member = await interaction.guild.members.fetch(userId);
            } catch (e) {}
            
            const fishStats = {
                totalFish: stats.totalFish,
                uniqueTypes: stats.uniqueFishTypes,
                inventoryValue: inventoryValue
            };
            
            const cooldowns = {
                daily: dailyAvailable,
                work: workAvailable,
                fish: fishAvailable
            };
            
            const imageBuffer = await generateProfileImage(user, member, stats, pokemonStats, fishStats, cooldowns);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });
            
            const fishButton = new ButtonBuilder()
                .setCustomId(`profile_fish_${userId}`)
                .setLabel('Collection')
                .setStyle(ButtonStyle.Primary);
            
            const achievementsButton = new ButtonBuilder()
                .setCustomId(`profile_achievements_${userId}`)
                .setLabel('Achievements')
                .setStyle(ButtonStyle.Secondary);
            
            const row = new ActionRowBuilder().addComponents(fishButton, achievementsButton);
            
            const embed = new EmbedBuilder()
                .setColor(0xe94560)
                .setImage('attachment://profile.png');
            
            await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
        }
    } catch (error) {
        console.error('Error handling profile button:', error);
        await interaction.editReply({ content: '❌ Erreur lors du traitement.', embeds: [], files: [], components: [] }).catch(() => {});
    }
}

/**
 * Create achievements embed for profile pagination
 */
export async function createAchievementsEmbed(message, userId, guildId) {
    const achievements = await getUserAchievements(userId, guildId);
    const collectionCheck = await checkCollectionComplete(userId, guildId, FISH);
    const hasCollection = await hasCollectionAchievement(userId, guildId);
    
    // Count fish by rarity from permanent collection
    const collection = await getFishCollection(userId, guildId);
    const fishByRarity = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0
    };
    
    Object.keys(collection).forEach((fishName) => {
        if (collection[fishName] === true && FISH[fishName]) {
            fishByRarity[FISH[fishName].rarity] = (fishByRarity[FISH[fishName].rarity] || 0) + 1;
        }
    });
    
    const totalByRarity = {
        common: Object.values(FISH).filter(f => f.rarity === 'common').length,
        uncommon: Object.values(FISH).filter(f => f.rarity === 'uncommon').length,
        rare: Object.values(FISH).filter(f => f.rarity === 'rare').length,
        epic: Object.values(FISH).filter(f => f.rarity === 'epic').length,
        legendary: Object.values(FISH).filter(f => f.rarity === 'legendary').length,
        mythic: Object.values(FISH).filter(f => f.rarity === 'mythic').length
    };
    
    // Fetch the user from the guild
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const user = member?.user || message.author;
    const avatarURL = user.displayAvatarURL({ dynamic: true, size: 256 });
    
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Profil de ${user.username} - Achievements`,
            iconURL: avatarURL
        })
        .setThumbnail(avatarURL)
        .setColor(hasCollection ? 0xffd700 : 0x5865F2)
        .setTitle('🏆 Achievements de Pêche')
        .addFields(
            {
                name: '📚 Collection Complète',
                value: hasCollection 
                    ? '✅ **COMPLÉTÉE !**\n👑 Rôle: **Maître Pêcheur**\n🎉 Vous avez collectionné tous les 64 poissons !'
                    : `📊 **${collectionCheck.collected}/${collectionCheck.total}** poissons collectionnés\n⏳ ${collectionCheck.total - collectionCheck.collected} poissons restants`,
                inline: false
            },
            {
                name: '📈 Progression par Rareté',
                value: [
                    `🐟 **Commun:** ${fishByRarity.common}/${totalByRarity.common}`,
                    `🐠 **Peu Commun:** ${fishByRarity.uncommon}/${totalByRarity.uncommon}`,
                    `🦈 **Rare:** ${fishByRarity.rare}/${totalByRarity.rare}`,
                    `🌙 **Épique:** ${fishByRarity.epic}/${totalByRarity.epic}`,
                    `✨ **Légendaire:** ${fishByRarity.legendary}/${totalByRarity.legendary}`,
                    `⭐ **Mythique:** ${fishByRarity.mythic}/${totalByRarity.mythic}`
                ].join('\n'),
                inline: true
            }
        )
        .setFooter({ text: 'Page 3/3 • Utilisez ◀️ pour revenir' })
        .setTimestamp();
    
    // Add missing fish list if collection not complete
    if (!hasCollection && collectionCheck.missing.length > 0 && collectionCheck.missing.length <= 20) {
        const missingList = collectionCheck.missing
            .slice(0, 20)
            .map(name => {
                const fish = FISH[name];
                return `${fish?.emoji || '❓'} ${name}`;
            })
            .join('\n');
        
        embed.addFields({
            name: `❌ Poissons Manquants (${collectionCheck.missing.length})`,
            value: missingList + (collectionCheck.missing.length > 20 ? '\n*... et plus*' : ''),
            inline: false
        });
    }
    
    return embed;
}

/**
 * Create fish inventory embed for profile pagination
 */
export async function createFishInventoryEmbed(message, userId, guildId) {
    const inventory = await getFishInventory(userId, guildId);
    const fishEntries = Object.entries(inventory);
    
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const avatarURL = member?.user.displayAvatarURL({ dynamic: true, size: 256 }) || message.author.displayAvatarURL({ dynamic: true, size: 256 });
    
    if (fishEntries.length === 0) {
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `Profil de ${member?.user.username || message.author.username} - Inventaire`,
                iconURL: avatarURL
            })
            .setThumbnail(avatarURL)
            .setTitle('📦 Inventaire de Pêche')
            .setDescription(`**${member?.user.username || message.author.username}**, votre inventaire est vide !\n\nUtilisez \`$fish\` pour pêcher.`)
            .setColor(0x808080)
            .setFooter({ text: 'Page 2/3 • Utilisez ◀️ pour revenir au profil' })
            .setTimestamp();
        
        return embed;
    }
    
    // Calculate total value
    let totalValue = 0;
    const fishList = [];
    
    for (const [fishName, quantity] of fishEntries) {
        if (FISH[fishName]) {
            const fishData = FISH[fishName];
            const value = fishData.price * quantity;
            totalValue += value;
            
            fishList.push({
                name: fishName,
                quantity,
                price: fishData.price,
                totalValue: value,
                emoji: fishData.emoji,
                rarity: fishData.rarity
            });
        }
    }
    
    // Sort by rarity (mythic > legendary > epic > rare > uncommon > common)
    const rarityOrder = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
    fishList.sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity]);
    
    // Create description with fish list
    let description = `**${member?.user.username || message.author.username}**, voici votre inventaire de pêche :\n\n`;
    
    // Group by rarity
    const byRarity = {};
    for (const fish of fishList) {
        if (!byRarity[fish.rarity]) {
            byRarity[fish.rarity] = [];
        }
        byRarity[fish.rarity].push(fish);
    }
    
    for (const rarity of ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']) {
        if (byRarity[rarity]) {
            description += `**${RARITY_NAMES[rarity]}:**\n`;
            for (const fish of byRarity[rarity]) {
                description += `${fish.emoji} **${fish.name}** x${fish.quantity} - ${fish.totalValue.toLocaleString()} coins\n`;
            }
            description += '\n';
        }
    }
    
    description += `\n💰 **Valeur totale:** ${totalValue.toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Profil de ${member?.user.username || message.author.username} - Inventaire`,
            iconURL: avatarURL
        })
        .setThumbnail(avatarURL)
        .setTitle('📦 Inventaire de Pêche')
        .setDescription(description)
        .setColor(0x3498db)
        .setFooter({ text: 'Page 2/3 • Utilisez ◀️ pour revenir au profil • Utilisez $sellfish [nom] [quantité] pour vendre' })
        .setTimestamp();
    
    return embed;
}

/**
 * Rebuild profile embed (used for pagination)
 */
export async function rebuildProfileEmbed(message, userId, guildId) {
    const stats = await getUserStats(userId, guildId);
    const inventory = await getFishInventory(userId, guildId);
    const fishEntries = Object.entries(inventory);
    
    let inventoryValue = 0;
    for (const [fishName, quantity] of fishEntries) {
        if (FISH[fishName]) {
            inventoryValue += FISH[fishName].price * quantity;
        }
    }
    
    const totalWealth = stats.balance + inventoryValue;
    const dailyAvailable = await canClaimDaily(userId, guildId);
    const workAvailable = await canWork(userId, guildId);
    const fishCheck = await canFish(userId, guildId);
    const fishAvailable = fishCheck.canFish;
    const collectionCheck = await checkCollectionComplete(userId, guildId, FISH);
    const hasCollection = await hasCollectionAchievement(userId, guildId);
    const collectionProgress = collectionCheck.total > 0 
        ? Math.round((collectionCheck.collected / collectionCheck.total) * 100) 
        : 0;
    
    const progressBarLength = 20;
    const filledLength = Math.round((collectionCheck.collected / collectionCheck.total) * progressBarLength);
    const emptyLength = progressBarLength - filledLength;
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const createdDate = member?.user.createdAt
        ? member.user.createdAt.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
        : 'Inconnue';
    
    let joinedDate = 'Inconnue';
    let daysSinceJoin = 0;
    if (member?.joinedAt) {
        joinedDate = member.joinedAt.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        daysSinceJoin = Math.floor((new Date() - member.joinedAt) / (1000 * 60 * 60 * 24));
    }
    
    const avatarURL = member?.user.displayAvatarURL({ dynamic: true, size: 256 }) || message.author.displayAvatarURL({ dynamic: true, size: 256 });
    
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Profil de ${member?.user.username || message.author.username}`,
            iconURL: avatarURL
        })
        .setThumbnail(avatarURL)
        .setColor(0x5865F2)
        .addFields(
            {
                name: '💰 Économie',
                value: [
                    `💵 **Solde:** ${stats.balance.toLocaleString()} coins`,
                    `📊 **Total gagné:** ${stats.totalEarned.toLocaleString()} coins`,
                    `💸 **Total dépensé:** ${stats.totalSpent.toLocaleString()} coins`,
                    `💎 **Valeur totale:** ${totalWealth.toLocaleString()} coins`
                ].join('\n'),
                inline: true
            },
            {
                name: '📈 Statistiques',
                value: [
                    `📝 **Transactions:** ${stats.transactionCount}`,
                    `🎣 **Poissons pêchés:** ${stats.totalFish}`,
                    `🐟 **Types de poissons:** ${stats.uniqueFishTypes}`,
                    `📦 **Valeur inventaire:** ${inventoryValue.toLocaleString()} coins`
                ].join('\n'),
                inline: true
            },
            {
                name: '⏰ Cooldowns',
                value: [
                    dailyAvailable ? '✅ **Daily:** Disponible' : '⏳ **Daily:** En attente',
                    workAvailable ? '✅ **Work:** Disponible' : '⏳ **Work:** En attente',
                    fishAvailable ? '✅ **Fish:** Disponible' : '⏳ **Fish:** En attente'
                ].join('\n'),
                inline: true
            }
        )
        .setFooter({ 
            text: `Page 1/3 • Compte créé le ${createdDate} • Rejoint le serveur le ${joinedDate} (${daysSinceJoin} jour${daysSinceJoin > 1 ? 's' : ''})` 
        })
        .setTimestamp();
    
    return embed;
}

/**
 * Help command - Show available commands
 */
// Help categories definition
const HELP_CATEGORIES = {
    general: {
        name: '📋 Général',
        emoji: '📋',
        color: 0x5865F2,
        description: 'Commandes générales et informations',
        commands: [
            '`$help [catégorie]` - Afficher l\'aide (catégories: general, economie, peche, jeux, casino, musique, pokemon, admin)',
            '`$profile` ou `$p` - Voir votre profil complet',
            '`$leaderboard` ou `$lb` - Top 10 des plus riches',
            '`$say <message>` - Faire parler le bot'
        ]
    },
    economie: {
        name: '💰 Économie',
        emoji: '💰',
        color: 0xF1C40F,
        description: 'Gagnez et gérez vos coins',
        commands: [
            '`$balance` ou `$bal` - Vérifier votre solde',
            '`$daily` - Récompense quotidienne (500 coins, reset à minuit)',
            '`$work` - Travailler (100-500 coins, cooldown 5h)',
            '`$give @user <montant>` - Donner des coins',
            '',
            '**🎤 Récompenses Vocales**',
            'Restez en vocal 30+ min → **50 coins/30min** (max 4h = 400 coins)'
        ]
    },
    peche: {
        name: '🎣 Pêche',
        emoji: '🎣',
        color: 0x3498DB,
        description: 'Attrapez des poissons et vendez-les',
        commands: [
            '`$fish` ou `$peche` - Aller pêcher (cooldown 1h)',
            '`$inventory` ou `$inv` - Voir vos poissons',
            '`$sellfish [nom] [qté]` - Vendre vos poissons',
            '`$sellall` - Vendre tous vos poissons',
            '`$fishstats` - Voir vos statistiques de pêche',
            '`$fishtypes` - Liste des poissons et leur rareté',
            '`$achievements` - Voir vos succès de pêche'
        ]
    },
    jeux: {
        name: '🎮 Jeux',
        emoji: '🎮',
        color: 0xE91E63,
        description: 'Mini-jeux et divertissement',
        commands: [
            '`$roll` - Lancer une pièce (pile ou face)',
            '`$pfc [@user]` - Pierre-Feuille-Ciseaux',
            '`$faaahhh` ou `$fah` - Jouer un son en vocal',
            '`$soundboard` - Liste des sons disponibles'
        ]
    },
    casino: {
        name: '🎰 Casino',
        emoji: '🎰',
        color: 0x9B59B6,
        description: 'Jeux de hasard et de chance!',
        commands: [
            '**🎮 Jeux:**',
            '`$casino` - Voir tous les jeux',
            '`$slots <montant>` - Machine à sous',
            '`$wheel <montant>` - Roue de la fortune',
            '`$coinflip <montant>` - Pile ou face',
            '`$duel @joueur <montant>` - 8 mini-jeux VS!',
            '`$bowser <montant>` - Zone Danger (risqué!)',
            '`$allin` - Miser TOUT au slots!',
            '',
            '**🎮 Mini-jeux Duel (9 jeux):**',
            '🎲 Dés • 🏇 Course • 🃏 Cartes • ✊ Shifumi',
            '⚡ Réflexes • 🎰 Slots • 🔢 Nombre • 💣 Bombe • 🧮 Calcul'
        ]
    },
    musique: {
        name: '🎵 Musique',
        emoji: '🎵',
        color: 0x1DB954,
        description: 'Écoutez de la musique en vocal',
        commands: [
            '**Lecture:**',
            '`$play <url/recherche>` ou `$p` - Jouer une musique',
            '`$pause` - Mettre en pause',
            '`$resume` - Reprendre la lecture',
            '`$skip` ou `$next` - Passer à la suivante',
            '`$stop` - Arrêter et vider la queue',
            '',
            '**File d\'attente:**',
            '`$queue` ou `$q` - Voir la file d\'attente',
            '`$nowplaying` ou `$np` - Musique en cours',
            '`$remove <position>` - Retirer une musique',
            '`$clear` - Vider la file d\'attente',
            '',
            '**Contrôles:**',
            '`$volume <0-100>` ou `$vol` - Régler le volume',
            '`$loop` - Activer/désactiver la boucle',
            '`$shuffle` - Mélanger la queue',
            '`$seek <secondes>` - Aller à un moment précis',
            '`$leave` ou `$disconnect` - Quitter le vocal',
            '',
            '**Text-to-Speech:**',
            '`$tts <texte>` - Faire parler le bot',
            '`$tts -en Hello` - TTS en anglais',
            '`$tts -fr Bonjour` - TTS en français'
        ]
    },
    pokemon: {
        name: '🐾 Pokémon',
        emoji: '🐾',
        color: 0xFFCB05,
        description: 'Attrapez-les tous !',
        commands: [
            '**Capture:**',
            '`$catch` ou `$attraper` - Capturer un Pokémon (cooldown 15min)',
            '⚡ Les légendaires/fabuleux nécessitent un QTE rapide !',
            '',
            '**Collection:**',
            '`$pokedex [page]` ou `$dex` - Voir votre Pokédex complet',
            '`$dex legendary/mythical/starter/pseudo/shiny` - Filtrer le Pokédex',
            '`$pc [page]` ou `$box` - Voir tous vos Pokémon capturés',
            '',
            '**Évolution:**',
            '`$evolve <n° Pokédex>` - Faire évoluer un Pokémon',
            '`$evolve <n°> mega [pierre]` - Méga-évolution',
            '• Coûts: 3k/10k/20k (normal) ou 10k/20k/50k (spécial)',
            '',
            '**Méga-Pierres:**',
            '`$megashop` - Voir la boutique des Méga-Pierres',
            '`$megashop buy <pierre>` - Acheter une Méga-Pierre',
            '',
            '**Informations:**',
            '`$pokemon <nom/numéro>` - Infos sur un Pokémon',
            '• Recherche en français ou anglais (1025 Pokémon)',
            '• Exemple: `$pokemon dracaufeu` ou `$pokemon 6`'
        ]
    },
    admin: {
        name: '⚙️ Administration',
        emoji: '⚙️',
        color: 0xE74C3C,
        description: 'Commandes réservées aux admins',
        commands: [
            '`$setbalance @user <montant>` - Définir le solde',
            '`$addmoney @user <montant>` - Ajouter des coins',
            '`$removemoney @user <montant>` - Retirer des coins',
            '`$buildpokemoncache` - Reconstruire le cache des noms FR',
            '`$buildcategoriescache` - Reconstruire le cache des catégories'
        ]
    }
};

// Aliases for category names
const CATEGORY_ALIASES = {
    'général': 'general', 'general': 'general', 'gen': 'general',
    'économie': 'economie', 'economie': 'economie', 'eco': 'economie', 'money': 'economie',
    'pêche': 'peche', 'peche': 'peche', 'fish': 'peche', 'fishing': 'peche',
    'jeux': 'jeux', 'games': 'jeux', 'game': 'jeux', 'fun': 'jeux',
    'casino': 'casino', 'slot': 'casino', 'slots': 'casino', 'gamble': 'casino',
    'musique': 'musique', 'music': 'musique', 'song': 'musique', 'songs': 'musique',
    'pokémon': 'pokemon', 'pokemon': 'pokemon', 'poke': 'pokemon', 'pk': 'pokemon',
    'admin': 'admin', 'administration': 'admin', 'mod': 'admin'
};

// Emoji to category mapping for reactions
const EMOJI_TO_CATEGORY = {
    '📋': 'general',
    '💰': 'economie',
    '🎣': 'peche',
    '🎮': 'jeux',
    '🎰': 'casino',
    '🎵': 'musique',
    '🐾': 'pokemon',
    '⚙️': 'admin',
    '🏠': 'home'
};

// Category order for reactions
const CATEGORY_ORDER = ['📋', '💰', '🎣', '🎮', '🎰', '🎵', '🐾', '⚙️'];

/**
 * Create the main help menu embed
 */
function createMainHelpEmbed() {
    return new EmbedBuilder()
        .setTitle('📚 Aide du Bot')
        .setDescription(
            '**Réagissez avec un emoji pour voir une catégorie !**\n\n' +
            '📋 Général • 💰 Économie • 🎣 Pêche • 🎮 Jeux\n' +
            '🎰 Casino • 🎵 Musique • 🐾 Pokémon • ⚙️ Admin\n\n' +
            '*Ou utilisez `$help <catégorie>`*'
        )
        .addFields(
            Object.entries(HELP_CATEGORIES).map(([key, category]) => ({
                name: category.name,
                value: category.description,
                inline: true
            }))
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Préfixe: $ • Réagissez pour naviguer • 🏠 = Menu principal' })
        .setTimestamp();
}

/**
 * Create a category embed
 */
function createCategoryEmbed(categoryKey) {
    const category = HELP_CATEGORIES[categoryKey];
    if (!category) return null;
    
    return new EmbedBuilder()
        .setTitle(`${category.name}`)
        .setDescription(`${category.description}\n\n${category.commands.join('\n')}`)
        .setColor(category.color)
        .setFooter({ text: 'Réagissez 🏠 pour revenir au menu principal' })
        .setTimestamp();
}

// Store active help messages for reaction handling
const activeHelpMessages = new Map();

export async function helpCommand(message, args = []) {
    const categoryArg = args[0]?.toLowerCase();
    
    // If a category is specified, show that category directly (no reactions)
    if (categoryArg) {
        const categoryKey = CATEGORY_ALIASES[categoryArg];
        
        if (categoryKey && HELP_CATEGORIES[categoryKey]) {
            const embed = createCategoryEmbed(categoryKey);
            return message.reply({ embeds: [embed] });
        } else {
            return message.reply(`❌ Catégorie inconnue: \`${categoryArg}\`\n\n**Catégories disponibles:** general, economie, peche, jeux, casino, musique, pokemon, admin`);
        }
    }
    
    // Show main help menu with reactions
    const embed = createMainHelpEmbed();
    const helpMsg = await message.reply({ embeds: [embed] });
    
    // Add reactions
    try {
        for (const emoji of CATEGORY_ORDER) {
            await helpMsg.react(emoji);
        }
        await helpMsg.react('🏠');
    } catch (error) {
        console.error('Error adding reactions:', error);
    }
    
    // Store message info for reaction handling
    activeHelpMessages.set(helpMsg.id, {
        odiserId: message.author.id,
        currentView: 'home',
        createdAt: Date.now()
    });
    
    // Create reaction collector
    const filter = (reaction, user) => {
        return !user.bot && 
               (CATEGORY_ORDER.includes(reaction.emoji.name) || reaction.emoji.name === '🏠');
    };
    
    const collector = helpMsg.createReactionCollector({ 
        filter, 
        time: 120000 // 2 minutes
    });
    
    collector.on('collect', async (reaction, user) => {
        // Remove user's reaction
        try {
            await reaction.users.remove(user.id);
        } catch (error) {
            // Ignore if we can't remove reaction
        }
        
        const emoji = reaction.emoji.name;
        const categoryKey = EMOJI_TO_CATEGORY[emoji];
        
        if (!categoryKey) return;
        
        let newEmbed;
        if (categoryKey === 'home') {
            newEmbed = createMainHelpEmbed();
        } else {
            newEmbed = createCategoryEmbed(categoryKey);
        }
        
        if (newEmbed) {
            try {
                await helpMsg.edit({ embeds: [newEmbed] });
            } catch (error) {
                console.error('Error updating help message:', error);
            }
        }
    });
    
    collector.on('end', async () => {
        // Remove from active messages
        activeHelpMessages.delete(helpMsg.id);
        
        // Update embed to show it's no longer interactive
        try {
            const finalEmbed = createMainHelpEmbed()
                .setFooter({ text: 'Ce menu a expiré. Utilisez $help pour un nouveau menu.' });
            await helpMsg.edit({ embeds: [finalEmbed] });
            await helpMsg.reactions.removeAll();
        } catch (error) {
            // Ignore if message was deleted
        }
    });
}
