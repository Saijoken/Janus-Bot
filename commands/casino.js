import {
    getBalance,
    addMoney,
    removeMoney,
    transferMoney
} from '../database.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// ==================== CASINO SYSTEM ====================
// Chaotic, unpredictable, and FUN!

// ==================== SYMBOLS & CONSTANTS ====================

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '💎', '7️⃣', '🍄', '👑'];

const WHEEL_SEGMENTS = [
    { emoji: '💰', name: 'JACKPOT', multiplier: 5.0, weight: 2, color: 0xffd700 },
    { emoji: '⭐', name: 'Étoile', multiplier: 3.0, weight: 5, color: 0xffff00 },
    { emoji: '🍄', name: 'Champignon', multiplier: 2.0, weight: 10, color: 0xff6b6b },
    { emoji: '🎁', name: 'Bonus', multiplier: 1.5, weight: 15, color: 0x00ff00 },
    { emoji: '🔄', name: 'Rejouer', multiplier: 1.0, weight: 15, special: 'replay', color: 0x00bfff },
    { emoji: '➡️', name: 'Rien', multiplier: 0.5, weight: 20, color: 0x808080 },
    { emoji: '💀', name: 'Bowser', multiplier: 0, weight: 8, special: 'bowser', color: 0x8b0000 },
    { emoji: '🌀', name: 'CHAOS', multiplier: -1, weight: 5, special: 'chaos', color: 0x9400d3 },
    { emoji: '🎲', name: 'Double ou Rien', multiplier: -1, weight: 10, special: 'double', color: 0xff4500 },
    { emoji: '🌟', name: 'MEGA STAR', multiplier: 10.0, weight: 1, color: 0xff69b4 },
];

const CHAOS_EVENTS = [
    { name: '🌪️ TORNADE DE COINS', effect: 'steal_random', description: 'Vous volez des coins à un joueur aléatoire!' },
    { name: '🎭 INVERSION', effect: 'reverse', description: 'Votre perte devient un gain (ou vice versa)!' },
    { name: '⚡ SUPER STAR', effect: 'super_multiply', description: 'Multiplicateur x10 sur votre mise!' },
    { name: '🌈 ARC-EN-CIEL', effect: 'random_gift', description: 'Cadeau aléatoire de 100 à 5000 coins!' },
    { name: '💣 BOMBE', effect: 'lose_half', description: 'Vous perdez la moitié de votre solde!' },
    { name: '🎪 CIRQUE', effect: 'triple_or_nothing', description: 'Triplez votre mise... ou perdez tout!' },
    { name: '🔮 MYSTÈRE', effect: 'mystery_box', description: 'Boîte mystère... qui sait ce qu\'il y a dedans?' },
    { name: '👻 FANTÔME', effect: 'ghost', description: 'Le fantôme vole votre mise... et la double!' },
];

const BOWSER_EVENTS = [
    { name: '🔥 Taxe Bowser', effect: 'tax', percent: 10, description: 'Bowser prend 10% de votre solde!' },
    { name: '💀 Malédiction', effect: 'curse', percent: 25, description: 'Bowser prend 25% de votre solde!' },
    { name: '🎰 Bowser Slot', effect: 'bowser_slot', description: 'Bowser vous force à jouer son slot!' },
    { name: '😈 Généreux?', effect: 'generous', description: 'Bowser est... généreux? +500 coins!' },
    { name: '⚫ Trou Noir', effect: 'black_hole', percent: 50, description: 'Bowser aspire 50% de votre solde!' },
    { name: '🎁 Faux Cadeau', effect: 'fake_gift', description: 'C\'était un piège! -1000 coins!' },
];

// ==================== DUEL MINI-GAMES ====================

const DUEL_MINIGAMES = [
    { id: 'dice_battle', name: '🎲 Bataille de Dés', description: 'Lancez les dés! Le plus haut gagne!' },
    { id: 'horse_race', name: '🏇 Course de Chevaux', description: 'Choisissez votre cheval! (CHOIX)' },
    { id: 'card_draw', name: '🃏 Carte la Plus Haute', description: 'Choisissez parmi 4 cartes cachées! (CHOIX)' },
    { id: 'rps', name: '✊ Pierre-Papier-Ciseaux', description: 'Le classique! Choisissez! (CHOIX)' },
    { id: 'target', name: '⚡ Test de Réflexes', description: 'Premier à cliquer gagne! (SKILL)' },
    { id: 'slots_battle', name: '🎰 Bataille de Slots', description: 'Tournez les rouleaux! Meilleur combo gagne!' },
    { id: 'number_guess', name: '🔢 Devine le Nombre', description: 'Tapez votre nombre! (CHOIX)' },
    { id: 'bomb_defuse', name: '💣 Désamorçage', description: 'Choisissez le bon fil! (CHOIX)' },
    { id: 'math_challenge', name: '🧮 Calcul Mental', description: 'Premier à calculer gagne! (SKILL)' },
];

const HORSES = [
    { name: 'Éclair', emoji: '⚡', color: 0xffff00 },
    { name: 'Tempête', emoji: '🌪️', color: 0x808080 },
    { name: 'Flamme', emoji: '🔥', color: 0xff4500 },
    { name: 'Étoile', emoji: '⭐', color: 0xffd700 },
    { name: 'Ombre', emoji: '🌑', color: 0x2f2f2f },
];

const CARDS = [
    { value: 2, name: '2', emoji: '2️⃣' },
    { value: 3, name: '3', emoji: '3️⃣' },
    { value: 4, name: '4', emoji: '4️⃣' },
    { value: 5, name: '5', emoji: '5️⃣' },
    { value: 6, name: '6', emoji: '6️⃣' },
    { value: 7, name: '7', emoji: '7️⃣' },
    { value: 8, name: '8', emoji: '8️⃣' },
    { value: 9, name: '9', emoji: '9️⃣' },
    { value: 10, name: '10', emoji: '🔟' },
    { value: 11, name: 'Valet', emoji: '🎴' },
    { value: 12, name: 'Dame', emoji: '👸' },
    { value: 13, name: 'Roi', emoji: '🤴' },
    { value: 14, name: 'As', emoji: '🅰️' },
];

const CARD_SUITS = ['♠️', '♥️', '♦️', '♣️'];

const LUCKY_MESSAGES = [
    "Les étoiles sont alignées pour vous! 🌟",
    "Vous sentez la chance aujourd'hui! 🍀",
    "Une aura dorée vous entoure! ✨",
    "Le destin vous sourit! 😊",
    "C'est votre jour de chance! 🎉",
];

const UNLUCKY_MESSAGES = [
    "Un nuage noir plane au-dessus de vous... ☁️",
    "Bowser vous observe de loin... 👀",
    "Les dés semblent truqués... 🎲",
    "Vous avez un mauvais pressentiment... 😰",
    "La malchance vous colle aux baskets... 🥾",
];

// ==================== HELPER FUNCTIONS ====================

function getRandomSymbol() {
    return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
}

function getWeightedWheelSegment() {
    const totalWeight = WHEEL_SEGMENTS.reduce((sum, seg) => sum + seg.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const segment of WHEEL_SEGMENTS) {
        random -= segment.weight;
        if (random <= 0) return segment;
    }
    return WHEEL_SEGMENTS[0];
}

function getRandomChaosEvent() {
    return CHAOS_EVENTS[Math.floor(Math.random() * CHAOS_EVENTS.length)];
}

function getRandomBowserEvent() {
    return BOWSER_EVENTS[Math.floor(Math.random() * BOWSER_EVENTS.length)];
}

function calculateSlotPayout(symbols, bet, luckModifier = 1.0) {
    const [a, b, c] = symbols;
    
    // MEGA JACKPOT - Three 7️⃣ or three 👑
    if (a === b && b === c && (a === '7️⃣' || a === '👑')) {
        return { type: 'mega_jackpot', multiplier: 10.0 * luckModifier, win: true };
    }
    
    // Triple match
    if (a === b && b === c) {
        if (a === '💎') return { type: 'triple_diamond', multiplier: 5.0 * luckModifier, win: true };
        if (a === '⭐') return { type: 'triple_star', multiplier: 4.0 * luckModifier, win: true };
        if (a === '🍄') return { type: 'triple_mushroom', multiplier: 3.5 * luckModifier, win: true };
        return { type: 'triple', multiplier: 3.0 * luckModifier, win: true };
    }
    
    // Double match
    if (a === b || b === c || a === c) {
        return { type: 'double', multiplier: 1.5 * luckModifier, win: true };
    }
    
    // Mario Party chaos: random small wins
    if (Math.random() < 0.35 * luckModifier) {
        return { type: 'lucky', multiplier: 0.8, win: true };
    }
    
    // Random CHAOS EVENT (5% chance)
    if (Math.random() < 0.05) {
        return { type: 'chaos', multiplier: 0, win: false, chaos: true };
    }
    
    return { type: 'none', multiplier: 0, win: false };
}

async function applyChaoEffect(message, userId, guildId, bet, event) {
    let result = { coins: 0, description: event.description };
    
    switch (event.effect) {
        case 'steal_random':
            // Random bonus (simulating "stealing" from the house)
            const stolen = Math.floor(Math.random() * 1000) + 200;
            await addMoney(userId, guildId, stolen, 'chaos_steal', 'Chaos: Vol de coins');
            result.coins = stolen;
            result.description = `${event.description}\n💰 Vous avez "volé" **${stolen}** coins!`;
            break;
            
        case 'reverse':
            // Give back double the bet
            const reversed = bet * 2;
            await addMoney(userId, guildId, reversed, 'chaos_reverse', 'Chaos: Inversion');
            result.coins = reversed;
            result.description = `${event.description}\n🔄 Vous récupérez **${reversed}** coins!`;
            break;
            
        case 'super_multiply':
            const superWin = bet * 10;
            await addMoney(userId, guildId, superWin, 'chaos_super', 'Chaos: Super Star');
            result.coins = superWin;
            result.description = `${event.description}\n⚡ Vous gagnez **${superWin}** coins!`;
            break;
            
        case 'random_gift':
            const gift = Math.floor(Math.random() * 4900) + 100;
            await addMoney(userId, guildId, gift, 'chaos_gift', 'Chaos: Cadeau');
            result.coins = gift;
            result.description = `${event.description}\n🎁 Cadeau de **${gift}** coins!`;
            break;
            
        case 'lose_half':
            const currentBalance = await getBalance(userId, guildId);
            const lost = Math.floor(currentBalance / 2);
            if (lost > 0) {
                await removeMoney(userId, guildId, lost, 'chaos_bomb', 'Chaos: Bombe');
            }
            result.coins = -lost;
            result.description = `${event.description}\n💥 Vous perdez **${lost}** coins!`;
            break;
            
        case 'triple_or_nothing':
            if (Math.random() < 0.33) {
                const tripleWin = bet * 3;
                await addMoney(userId, guildId, tripleWin, 'chaos_triple', 'Chaos: Triple');
                result.coins = tripleWin;
                result.description = `${event.description}\n🎪 TRIPLÉ! Vous gagnez **${tripleWin}** coins!`;
            } else {
                result.coins = 0;
                result.description = `${event.description}\n😢 Perdu! Vous ne gagnez rien...`;
            }
            break;
            
        case 'mystery_box':
            const mystery = Math.floor(Math.random() * 3000) - 500; // Can be negative!
            if (mystery > 0) {
                await addMoney(userId, guildId, mystery, 'chaos_mystery', 'Chaos: Mystère');
            } else if (mystery < 0) {
                const balance = await getBalance(userId, guildId);
                const actualLoss = Math.min(Math.abs(mystery), balance);
                if (actualLoss > 0) {
                    await removeMoney(userId, guildId, actualLoss, 'chaos_mystery', 'Chaos: Mystère');
                }
            }
            result.coins = mystery;
            result.description = `${event.description}\n🔮 La boîte contenait **${mystery > 0 ? '+' : ''}${mystery}** coins!`;
            break;
            
        case 'ghost':
            const ghostBonus = bet * 2;
            await addMoney(userId, guildId, ghostBonus, 'chaos_ghost', 'Chaos: Fantôme');
            result.coins = ghostBonus;
            result.description = `${event.description}\n👻 Le fantôme vous rend **${ghostBonus}** coins!`;
            break;
    }
    
    return result;
}

// ==================== MAIN CASINO COMMAND ====================

export async function casinoCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Show help if no args
    if (args.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('🎰 CASINO 🎰')
            .setDescription(
                '**Bienvenue au Casino!**\n\n' +
                '🎮 **Jeux disponibles:**\n\n' +
                '🎰 **Slots** - `$slots <montant>`\n' +
                '└ Machine à sous avec événements spéciaux!\n\n' +
                '🎡 **Roue** - `$wheel <montant>`\n' +
                '└ Faites tourner la roue de la fortune!\n\n' +
                '🪙 **Pile ou Face** - `$coinflip <montant>`\n' +
                '└ Double ou rien... avec surprises!\n\n' +
                '⚔️ **Duel** - `$duel <@joueur> <montant>`\n' +
                '└ 8 mini-jeux aléatoires! Affrontez vos amis!\n\n' +
                '👹 **Zone Danger** - `$bowser <montant>`\n' +
                '└ Haut risque, haute récompense... ou pas!\n\n' +
                '💸 **ALL-IN** - `$allin`\n' +
                '└ Misez TOUT au slots!'
            )
            .setColor(0xffd700)
            .setFooter({ text: '⚠️ Des événements aléatoires peuvent survenir!' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Parse bet amount and redirect to slots
    const betAmount = parseInt(args[0]);
    if (!isNaN(betAmount) && betAmount > 0) {
        await slotsCommand(message, [betAmount.toString()]);
    } else {
        await message.reply('❌ Utilisez `$casino` pour voir les jeux disponibles ou `$slots <montant>` pour jouer!');
    }
}

// ==================== SLOTS COMMAND ====================

export async function slotsCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length === 0) {
        await message.reply('🎰 **Utilisation:** `$slots <montant>`\n💡 Exemple: `$slots 100`');
        return;
    }
    
    const betAmount = parseInt(args[0]);
    
    if (isNaN(betAmount) || betAmount <= 0) {
        await message.reply('❌ Montant invalide! Utilisez un nombre positif.');
        return;
    }
    
    const balance = await getBalance(userId, guildId);
    if (balance < betAmount) {
        await message.reply(`❌ Solde insuffisant! Vous avez **${balance.toLocaleString()}** coins.`);
        return;
    }
    
    // Remove bet
    const newBalance = await removeMoney(userId, guildId, betAmount, 'slots_bet', `Mise slots: ${betAmount}`);
    if (newBalance === null) {
        await message.reply('❌ Erreur de transaction!');
        return;
    }
    
    // Random luck modifier (Mario Party chaos!)
    const luckModifier = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    const isLucky = Math.random() < 0.1;
    const isUnlucky = !isLucky && Math.random() < 0.1;
    
    // Initial spinning embed
    const spinEmbed = new EmbedBuilder()
        .setTitle('🎰 SLOTS - LES ROULEAUX TOURNENT!')
        .setDescription(isLucky ? LUCKY_MESSAGES[Math.floor(Math.random() * LUCKY_MESSAGES.length)] : 
                       isUnlucky ? UNLUCKY_MESSAGES[Math.floor(Math.random() * UNLUCKY_MESSAGES.length)] : 
                       '🎲 **Tirage en cours...**')
        .addFields(
            { name: '🎰 Rouleaux', value: '❓ | ❓ | ❓', inline: false },
            { name: '💰 Mise', value: `**${betAmount.toLocaleString()}** coins`, inline: true }
        )
        .setColor(0xffd700)
        .setTimestamp();
    
    const reply = await message.reply({ embeds: [spinEmbed] });
    
    // Spinning animation
    for (let i = 0; i < 4; i++) {
        await new Promise(resolve => setTimeout(resolve, 400));
        const tempSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
        const tempEmbed = EmbedBuilder.from(spinEmbed)
            .spliceFields(0, 1, { name: '🎰 Rouleaux', value: `${tempSymbols[0]} | ${tempSymbols[1]} | ${tempSymbols[2]}`, inline: false });
        await reply.edit({ embeds: [tempEmbed] });
    }
    
    // Final result
    await new Promise(resolve => setTimeout(resolve, 500));
    const finalSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const result = calculateSlotPayout(finalSymbols, betAmount, isLucky ? 1.5 : isUnlucky ? 0.7 : luckModifier);
    
    let finalBalance = newBalance;
    let title, description, color;
    
    // Handle CHAOS event
    if (result.chaos) {
        const chaosEvent = getRandomChaosEvent();
        const chaosResult = await applyChaoEffect(message, userId, guildId, betAmount, chaosEvent);
        finalBalance = await getBalance(userId, guildId);
        
        title = `🌀 ÉVÉNEMENT CHAOS: ${chaosEvent.name}`;
        description = chaosResult.description;
        color = 0x9400d3;
    } else if (result.win) {
        const winAmount = Math.floor(betAmount * result.multiplier);
        finalBalance = await addMoney(userId, guildId, winAmount, 'slots_win', `Gain slots: ${winAmount}`);
        
        const winTypes = {
            'mega_jackpot': { title: '🎉🎉🎉 MEGA JACKPOT!!! 🎉🎉🎉', color: 0xff69b4 },
            'triple_diamond': { title: '💎💎💎 TRIPLE DIAMANT!', color: 0x00ffff },
            'triple_star': { title: '⭐⭐⭐ TRIPLE ÉTOILE!', color: 0xffff00 },
            'triple_mushroom': { title: '🍄🍄🍄 CHAMPIGNON POWER!', color: 0xff6b6b },
            'triple': { title: '🎰 TRIPLE GAGNANT!', color: 0x00ff00 },
            'double': { title: '🎯 DOUBLE MATCH!', color: 0x32cd32 },
            'lucky': { title: '🍀 COUP DE CHANCE!', color: 0x90ee90 },
        };
        
        const winInfo = winTypes[result.type] || { title: '✅ Gagné!', color: 0x00ff00 };
        title = winInfo.title;
        description = `**${message.author.username}** gagne **${winAmount.toLocaleString()}** coins! (x${result.multiplier.toFixed(1)})`;
        color = winInfo.color;
    } else {
        title = '❌ Pas de chance...';
        description = `**${message.author.username}** perd **${betAmount.toLocaleString()}** coins!`;
        color = 0xff0000;
    }
    
    // Random bonus event (5% chance on any spin)
    let bonusText = '';
    if (Math.random() < 0.05) {
        const bonusCoins = Math.floor(Math.random() * 500) + 100;
        await addMoney(userId, guildId, bonusCoins, 'slots_bonus', 'Bonus surprise');
        finalBalance = await getBalance(userId, guildId);
        bonusText = `\n\n🎁 **BONUS SURPRISE!** +${bonusCoins} coins!`;
    }
    
    const finalEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description + bonusText)
        .addFields(
            { name: '🎰 Résultat', value: `${finalSymbols[0]} | ${finalSymbols[1]} | ${finalSymbols[2]}`, inline: false },
            { name: '💰 Mise', value: `**${betAmount.toLocaleString()}**`, inline: true },
            { name: '💵 Solde', value: `**${finalBalance.toLocaleString()}**`, inline: true }
        )
        .setColor(color)
        .setTimestamp();
    
    await reply.edit({ embeds: [finalEmbed] });
}

// ==================== WHEEL OF FORTUNE ====================

export async function wheelCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length === 0) {
        await message.reply('🎡 **Utilisation:** `$wheel <montant>`\n💡 Exemple: `$wheel 200`');
        return;
    }
    
    const betAmount = parseInt(args[0]);
    
    if (isNaN(betAmount) || betAmount <= 0) {
        await message.reply('❌ Montant invalide!');
        return;
    }
    
    const balance = await getBalance(userId, guildId);
    if (balance < betAmount) {
        await message.reply(`❌ Solde insuffisant! Vous avez **${balance.toLocaleString()}** coins.`);
        return;
    }
    
    await removeMoney(userId, guildId, betAmount, 'wheel_bet', `Mise roue: ${betAmount}`);
    
    // Spinning animation
    const spinEmbed = new EmbedBuilder()
        .setTitle('🎡 LA ROUE TOURNE...')
        .setDescription('🌀 **Clickety-clack-clickety-clack...**')
        .setColor(0xffd700)
        .setTimestamp();
    
    const reply = await message.reply({ embeds: [spinEmbed] });
    
    // Show spinning segments
    for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 350));
        const tempSeg = WHEEL_SEGMENTS[Math.floor(Math.random() * WHEEL_SEGMENTS.length)];
        const tempEmbed = EmbedBuilder.from(spinEmbed)
            .setDescription(`🎡 **${tempSeg.emoji} ${tempSeg.name}?**`);
        await reply.edit({ embeds: [tempEmbed] });
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Final segment
    let segment = getWeightedWheelSegment();
    let finalBalance = await getBalance(userId, guildId);
    let title, description, color;
    
    // Handle special segments
    if (segment.special === 'replay') {
        // Free replay - return bet
        await addMoney(userId, guildId, betAmount, 'wheel_replay', 'Roue: Rejouer');
        finalBalance = await getBalance(userId, guildId);
        title = '🔄 REJOUER!';
        description = `Votre mise de **${betAmount.toLocaleString()}** coins vous est rendue!\nRelancez la roue gratuitement!`;
        color = 0x00bfff;
    } else if (segment.special === 'bowser') {
        // Bowser steals coins!
        const bowserEvent = getRandomBowserEvent();
        let stolen = 0;
        
        if (bowserEvent.effect === 'generous') {
            await addMoney(userId, guildId, 500, 'wheel_bowser', 'Roue: Bowser généreux');
            stolen = -500;
        } else if (bowserEvent.effect === 'fake_gift') {
            const toRemove = Math.min(1000, finalBalance);
            if (toRemove > 0) await removeMoney(userId, guildId, toRemove, 'wheel_bowser', 'Roue: Faux cadeau');
            stolen = toRemove;
        } else if (bowserEvent.percent) {
            stolen = Math.floor(finalBalance * bowserEvent.percent / 100);
            if (stolen > 0) await removeMoney(userId, guildId, stolen, 'wheel_bowser', `Roue: ${bowserEvent.name}`);
        }
        
        finalBalance = await getBalance(userId, guildId);
        title = `👹 BOWSER: ${bowserEvent.name}`;
        description = `${bowserEvent.description}\n${stolen > 0 ? `💀 -${stolen} coins` : stolen < 0 ? `😈 +${Math.abs(stolen)} coins` : ''}`;
        color = 0x8b0000;
    } else if (segment.special === 'chaos') {
        const chaosEvent = getRandomChaosEvent();
        await applyChaoEffect(message, userId, guildId, betAmount, chaosEvent);
        finalBalance = await getBalance(userId, guildId);
        title = `🌀 CHAOS: ${chaosEvent.name}`;
        description = chaosEvent.description;
        color = 0x9400d3;
    } else if (segment.special === 'double') {
        // Double or nothing
        if (Math.random() < 0.5) {
            const won = betAmount * 2;
            await addMoney(userId, guildId, won, 'wheel_double', 'Roue: Double');
            finalBalance = await getBalance(userId, guildId);
            title = '🎲 DOUBLE!';
            description = `Vous gagnez **${won.toLocaleString()}** coins!`;
            color = 0x00ff00;
        } else {
            title = '🎲 RIEN!';
            description = `Vous perdez votre mise de **${betAmount.toLocaleString()}** coins!`;
            color = 0xff0000;
        }
    } else {
        // Normal multiplier
        const winAmount = Math.floor(betAmount * segment.multiplier);
        if (winAmount > 0) {
            await addMoney(userId, guildId, winAmount, 'wheel_win', `Roue: ${segment.name}`);
        }
        finalBalance = await getBalance(userId, guildId);
        
        if (segment.multiplier >= 5) {
            title = `🎉 ${segment.emoji} ${segment.name}!`;
        } else if (segment.multiplier >= 2) {
            title = `⭐ ${segment.emoji} ${segment.name}!`;
        } else if (segment.multiplier >= 1) {
            title = `✅ ${segment.emoji} ${segment.name}`;
        } else {
            title = `😕 ${segment.emoji} ${segment.name}`;
        }
        
        description = winAmount > 0 ? 
            `Vous gagnez **${winAmount.toLocaleString()}** coins! (x${segment.multiplier})` :
            `Vous perdez votre mise de **${betAmount.toLocaleString()}** coins...`;
        color = segment.color;
    }
    
    const finalEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .addFields(
            { name: '💰 Mise', value: `**${betAmount.toLocaleString()}**`, inline: true },
            { name: '💵 Solde', value: `**${finalBalance.toLocaleString()}**`, inline: true }
        )
        .setColor(color)
        .setTimestamp();
    
    await reply.edit({ embeds: [finalEmbed] });
}

// ==================== COIN FLIP ====================

export async function coinflipCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length === 0) {
        await message.reply('🪙 **Utilisation:** `$coinflip <montant>`\n💡 Devinez le bon côté pour doubler!');
        return;
    }
    
    const betAmount = parseInt(args[0]);
    
    if (isNaN(betAmount) || betAmount <= 0) {
        await message.reply('❌ Montant invalide!');
        return;
    }
    
    const balance = await getBalance(userId, guildId);
    if (balance < betAmount) {
        await message.reply(`❌ Solde insuffisant! Vous avez **${balance.toLocaleString()}** coins.`);
        return;
    }
    
    // Show choice buttons
    const choiceEmbed = new EmbedBuilder()
        .setTitle('🪙 PILE OU FACE?')
        .setDescription(
            `**${message.author.username}**, faites votre choix!\n\n` +
            `💰 **Mise:** ${betAmount.toLocaleString()} coins\n` +
            `🎯 **Gain potentiel:** ${(betAmount * 2).toLocaleString()} coins`
        )
        .setColor(0xffd700)
        .setFooter({ text: 'Vous avez 15 secondes pour choisir...' });
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('coinflip_pile')
                .setLabel('🟡 Pile')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('coinflip_face')
                .setLabel('⚪ Face')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const reply = await message.reply({ embeds: [choiceEmbed], components: [row] });
    
    try {
        // Wait for user choice
        const interaction = await reply.awaitMessageComponent({
            filter: i => i.user.id === userId,
            time: 15000
        });
        
        const playerChoice = interaction.customId === 'coinflip_pile' ? 'pile' : 'face';
        const playerChoiceEmoji = playerChoice === 'pile' ? '🟡' : '⚪';
        
        // Remove bet after choice is made
        await removeMoney(userId, guildId, betAmount, 'coinflip_bet', `Mise coinflip: ${betAmount}`);
        
        // Flip animation
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('🪙 LA PIÈCE TOURNE...')
                .setDescription(`Vous avez choisi: **${playerChoiceEmoji} ${playerChoice.toUpperCase()}**\n\n🌀 **Flip flip flip...**`)
                .setColor(0xffd700)],
            components: []
        });
        
        const sides = ['🟡', '⚪'];
        for (let i = 0; i < 4; i++) {
            await new Promise(resolve => setTimeout(resolve, 350));
            const side = sides[i % 2];
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🪙 LA PIÈCE TOURNE...')
                    .setDescription(`Vous avez choisi: **${playerChoiceEmoji} ${playerChoice.toUpperCase()}**\n\n${side} **Flip...**`)
                    .setColor(0xffd700)]
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Determine result
        const coinResult = Math.random() < 0.5 ? 'pile' : 'face';
        const coinResultEmoji = coinResult === 'pile' ? '🟡' : '⚪';
        const playerWins = playerChoice === coinResult;
        
        // Check for chaos (5% chance)
        const chaosChance = Math.random() < 0.05;
        let finalBalance;
        let title, description, color;
        
        if (chaosChance) {
            // CHAOS!
            const chaosEvent = getRandomChaosEvent();
            await applyChaoEffect(message, userId, guildId, betAmount, chaosEvent);
            finalBalance = await getBalance(userId, guildId);
            title = `🌀 CHAOS COIN!`;
            description = `La pièce: **${coinResultEmoji} ${coinResult.toUpperCase()}**\nVotre choix: **${playerChoiceEmoji} ${playerChoice.toUpperCase()}**\n\n**${chaosEvent.name}**\n${chaosEvent.description}`;
            color = 0x9400d3;
        } else if (playerWins) {
            // WIN!
            const winAmount = betAmount * 2;
            await addMoney(userId, guildId, winAmount, 'coinflip_win', `Gain coinflip: ${winAmount}`);
            finalBalance = await getBalance(userId, guildId);
            title = `${coinResultEmoji} ${coinResult.toUpperCase()}! GAGNÉ!`;
            description = `La pièce: **${coinResultEmoji} ${coinResult.toUpperCase()}**\nVotre choix: **${playerChoiceEmoji} ${playerChoice.toUpperCase()}** ✅\n\n🎉 Vous doublez votre mise!\n💰 **+${winAmount.toLocaleString()}** coins!`;
            color = 0x00ff00;
        } else {
            // LOSE
            finalBalance = await getBalance(userId, guildId);
            title = `${coinResultEmoji} ${coinResult.toUpperCase()}! PERDU...`;
            description = `La pièce: **${coinResultEmoji} ${coinResult.toUpperCase()}**\nVotre choix: **${playerChoiceEmoji} ${playerChoice.toUpperCase()}** ❌\n\n😢 Mauvais choix!\n💸 **-${betAmount.toLocaleString()}** coins`;
            color = 0xff0000;
        }
        
        const finalEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .addFields(
                { name: '💵 Solde', value: `**${finalBalance.toLocaleString()}** coins`, inline: true }
            )
            .setColor(color)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [finalEmbed] });
        
    } catch (error) {
        // Timeout - no choice made
        await reply.edit({
            embeds: [new EmbedBuilder()
                .setTitle('⏰ Temps écoulé!')
                .setDescription('Vous n\'avez pas fait de choix à temps.\nVotre mise n\'a pas été retirée.')
                .setColor(0x808080)],
            components: []
        });
    }
}

// ==================== DUEL MINI-GAMES FUNCTIONS ====================

function getRandomMinigame() {
    return DUEL_MINIGAMES[Math.floor(Math.random() * DUEL_MINIGAMES.length)];
}

// 🎲 DICE BATTLE - Both roll dice, highest wins
async function playDiceBattle(interaction, player1, player2) {
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🎲 BATAILLE DE DÉS!')
            .setDescription(`**${player1.username}** vs **${player2.username}**\n\n🎲 Les dés roulent...`)
            .setColor(0xff4500)]
    });
    
    await new Promise(r => setTimeout(r, 1500));
    
    // Each player rolls 2 dice
    const p1Roll1 = Math.floor(Math.random() * 6) + 1;
    const p1Roll2 = Math.floor(Math.random() * 6) + 1;
    const p2Roll1 = Math.floor(Math.random() * 6) + 1;
    const p2Roll2 = Math.floor(Math.random() * 6) + 1;
    const p1Total = p1Roll1 + p1Roll2;
    const p2Total = p2Roll1 + p2Roll2;
    
    const diceEmojis = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
    
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🎲 RÉSULTAT DES DÉS!')
            .setDescription(
                `**${player1.username}:** ${diceEmojis[p1Roll1]} + ${diceEmojis[p1Roll2]} = **${p1Total}**\n` +
                `**${player2.username}:** ${diceEmojis[p2Roll1]} + ${diceEmojis[p2Roll2]} = **${p2Total}**`
            )
            .setColor(0xff4500)]
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    if (p1Total > p2Total) return { winner: player1, loser: player2, details: `🎲 ${p1Total} contre ${p2Total}` };
    if (p2Total > p1Total) return { winner: player2, loser: player1, details: `🎲 ${p2Total} contre ${p1Total}` };
    
    // Tie - sudden death!
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('⚡ ÉGALITÉ! MORT SUBITE!')
            .setDescription('Un dernier dé pour tout décider!')
            .setColor(0xffd700)]
    });
    await new Promise(r => setTimeout(r, 1000));
    
    let p1Final = Math.floor(Math.random() * 6) + 1;
    let p2Final = Math.floor(Math.random() * 6) + 1;
    while (p1Final === p2Final) {
        p1Final = Math.floor(Math.random() * 6) + 1;
        p2Final = Math.floor(Math.random() * 6) + 1;
    }
    
    return p1Final > p2Final 
        ? { winner: player1, loser: player2, details: `⚡ Mort subite: ${diceEmojis[p1Final]} vs ${diceEmojis[p2Final]}` }
        : { winner: player2, loser: player1, details: `⚡ Mort subite: ${diceEmojis[p2Final]} vs ${diceEmojis[p1Final]}` };
}

// 🏇 HORSE RACE - Players choose their horse! (INTERACTIVE)
async function playHorseRace(interaction, player1, player2) {
    let p1Horse = null;
    let p2Horse = null;
    const availableHorses = [...HORSES];
    
    // Player 1 chooses first
    const p1Row = new ActionRowBuilder()
        .addComponents(
            ...availableHorses.map((horse, i) => 
                new ButtonBuilder()
                    .setCustomId(`horse_${i}`)
                    .setLabel(`${horse.emoji} ${horse.name}`)
                    .setStyle(ButtonStyle.Secondary)
            )
        );
    
    const horseMsg = await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🏇 COURSE DE CHEVAUX!')
            .setDescription(
                `**${player1.username}**, choisissez votre cheval!\n\n` +
                availableHorses.map(h => `${h.emoji} **${h.name}**`).join(' • ') +
                `\n\n⏱️ 10 secondes...`
            )
            .setColor(0x8b4513)],
        components: [p1Row]
    });
    
    try {
        const p1Interaction = await horseMsg.awaitMessageComponent({
            filter: i => i.user.id === player1.id,
            time: 10000
        });
        
        const p1Index = parseInt(p1Interaction.customId.split('_')[1]);
        p1Horse = availableHorses[p1Index];
        
        // Remove chosen horse for player 2
        const remainingHorses = availableHorses.filter((_, i) => i !== p1Index);
        
        const p2Row = new ActionRowBuilder()
            .addComponents(
                ...remainingHorses.map((horse, i) => 
                    new ButtonBuilder()
                        .setCustomId(`horse2_${i}`)
                        .setLabel(`${horse.emoji} ${horse.name}`)
                        .setStyle(ButtonStyle.Secondary)
                )
            );
        
        await p1Interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('🏇 COURSE DE CHEVAUX!')
                .setDescription(
                    `✅ **${player1.username}** a choisi **${p1Horse.emoji} ${p1Horse.name}**!\n\n` +
                    `**${player2.username}**, choisissez votre cheval!\n\n` +
                    remainingHorses.map(h => `${h.emoji} **${h.name}**`).join(' • ') +
                    `\n\n⏱️ 10 secondes...`
                )
                .setColor(0x8b4513)],
            components: [p2Row]
        });
        
        const p2Interaction = await horseMsg.awaitMessageComponent({
            filter: i => i.user.id === player2.id,
            time: 10000
        });
        
        const p2Index = parseInt(p2Interaction.customId.split('_')[1]);
        p2Horse = remainingHorses[p2Index];
        
        await p2Interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('🏇 LA COURSE COMMENCE!')
                .setDescription(
                    `**${player1.username}** → ${p1Horse.emoji} **${p1Horse.name}**\n` +
                    `**${player2.username}** → ${p2Horse.emoji} **${p2Horse.name}**\n\n` +
                    `🏁 C'est parti!`
                )
                .setColor(0x8b4513)],
            components: []
        });
        
    } catch (error) {
        // Timeout - assign random horses
        if (!p1Horse) p1Horse = availableHorses[Math.floor(Math.random() * availableHorses.length)];
        if (!p2Horse) {
            const remaining = availableHorses.filter(h => h.name !== p1Horse.name);
            p2Horse = remaining[Math.floor(Math.random() * remaining.length)];
        }
        
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('🏇 CHEVAUX ASSIGNÉS!')
                .setDescription(`Temps écoulé! Chevaux assignés automatiquement.`)
                .setColor(0x8b4513)],
            components: []
        });
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Race simulation
    let p1Pos = 0, p2Pos = 0;
    const finishLine = 10;
    
    for (let round = 0; round < 8 && p1Pos < finishLine && p2Pos < finishLine; round++) {
        p1Pos += Math.floor(Math.random() * 3) + 1;
        p2Pos += Math.floor(Math.random() * 3) + 1;
        
        const track1 = '▓'.repeat(Math.min(p1Pos, finishLine)) + p1Horse.emoji + '░'.repeat(Math.max(0, finishLine - p1Pos));
        const track2 = '▓'.repeat(Math.min(p2Pos, finishLine)) + p2Horse.emoji + '░'.repeat(Math.max(0, finishLine - p2Pos));
        
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('🏇 COURSE EN COURS...')
                .setDescription(
                    `${p1Horse.emoji} ${p1Horse.name}: ${track1} 🏁\n` +
                    `${p2Horse.emoji} ${p2Horse.name}: ${track2} 🏁`
                )
                .setColor(0x8b4513)]
        });
        
        await new Promise(r => setTimeout(r, 600));
    }
    
    if (p1Pos > p2Pos) return { winner: player1, loser: player2, details: `🏇 ${p1Horse.emoji} ${p1Horse.name} gagne!` };
    if (p2Pos > p1Pos) return { winner: player2, loser: player1, details: `🏇 ${p2Horse.emoji} ${p2Horse.name} gagne!` };
    
    return Math.random() < 0.5
        ? { winner: player1, loser: player2, details: `📸 Photo finish! ${p1Horse.emoji} gagne!` }
        : { winner: player2, loser: player1, details: `📸 Photo finish! ${p2Horse.emoji} gagne!` };
}

// 🃏 CARD DRAW - Each player picks from 4 hidden cards
async function playCardDraw(interaction, player1, player2) {
    // Generate 4 random cards for each player (different pools)
    const shuffleCards = () => {
        const shuffled = [...CARDS].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 4).map((card, i) => ({
            ...card,
            suit: CARD_SUITS[Math.floor(Math.random() * CARD_SUITS.length)],
            position: i + 1
        }));
    };
    
    const p1Cards = shuffleCards();
    const p2Cards = shuffleCards();
    let p1Choice = null;
    let p2Choice = null;
    
    // Player 1 picks first
    const p1Row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('card_1').setLabel('🎴 Carte 1').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('card_2').setLabel('🎴 Carte 2').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('card_3').setLabel('🎴 Carte 3').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('card_4').setLabel('🎴 Carte 4').setStyle(ButtonStyle.Secondary)
        );
    
    const p1Msg = await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🃏 CARTE LA PLUS HAUTE!')
            .setDescription(
                `**${player1.username}**, choisissez une carte face cachée!\n\n` +
                `🎴 🎴 🎴 🎴\n\n` +
                `⏱️ 15 secondes pour choisir...`
            )
            .setColor(0x1e90ff)],
        components: [p1Row]
    });
    
    try {
        const p1Interaction = await p1Msg.awaitMessageComponent({
            filter: i => i.user.id === player1.id,
            time: 15000
        });
        
        const p1Index = parseInt(p1Interaction.customId.split('_')[1]) - 1;
        p1Choice = p1Cards[p1Index];
        
        // Player 2 picks
        const p2Row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('card2_1').setLabel('🎴 Carte 1').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('card2_2').setLabel('🎴 Carte 2').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('card2_3').setLabel('🎴 Carte 3').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('card2_4').setLabel('🎴 Carte 4').setStyle(ButtonStyle.Secondary)
            );
        
        await p1Interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('🃏 CARTE LA PLUS HAUTE!')
                .setDescription(
                    `✅ **${player1.username}** a choisi sa carte!\n\n` +
                    `**${player2.username}**, à votre tour!\n\n` +
                    `🎴 🎴 🎴 🎴\n\n` +
                    `⏱️ 15 secondes pour choisir...`
                )
                .setColor(0x1e90ff)],
            components: [p2Row]
        });
        
        const p2Interaction = await p1Msg.awaitMessageComponent({
            filter: i => i.user.id === player2.id,
            time: 15000
        });
        
        const p2Index = parseInt(p2Interaction.customId.split('_')[1]) - 1;
        p2Choice = p2Cards[p2Index];
        
        // Reveal animation
        await p2Interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('🃏 RÉVÉLATION DES CARTES...')
                .setDescription('🎴 Les cartes se retournent...')
                .setColor(0x1e90ff)],
            components: []
        });
        
        await new Promise(r => setTimeout(r, 1500));
        
        // Show results
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('🃏 LES CARTES SONT RÉVÉLÉES!')
                .setDescription(
                    `**${player1.username}:** ${p1Choice.name} ${p1Choice.suit}\n` +
                    `**${player2.username}:** ${p2Choice.name} ${p2Choice.suit}`
                )
                .setColor(0x1e90ff)]
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        if (p1Choice.value > p2Choice.value) return { winner: player1, loser: player2, details: `🃏 ${p1Choice.name} bat ${p2Choice.name}!` };
        if (p2Choice.value > p1Choice.value) return { winner: player2, loser: player1, details: `🃏 ${p2Choice.name} bat ${p1Choice.name}!` };
        
        // Same value - suit decides (random)
        return Math.random() < 0.5
            ? { winner: player1, loser: player2, details: `🃏 Égalité! ${p1Choice.suit} bat ${p2Choice.suit}!` }
            : { winner: player2, loser: player1, details: `🃏 Égalité! ${p2Choice.suit} bat ${p1Choice.suit}!` };
            
    } catch (error) {
        // Timeout - random fallback
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('⏰ TEMPS ÉCOULÉ!')
                .setDescription('Un joueur n\'a pas choisi à temps!\nTirage aléatoire...')
                .setColor(0xff6600)],
            components: []
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        const p1Card = p1Choice || p1Cards[Math.floor(Math.random() * 4)];
        const p2Card = p2Choice || p2Cards[Math.floor(Math.random() * 4)];
        
        if (p1Card.value > p2Card.value) return { winner: player1, loser: player2, details: `🃏 ${p1Card.name} bat ${p2Card.name}! (auto)` };
        if (p2Card.value > p1Card.value) return { winner: player2, loser: player1, details: `🃏 ${p2Card.name} bat ${p1Card.name}! (auto)` };
        
        return Math.random() < 0.5
            ? { winner: player1, loser: player2, details: `🃏 Tirage au sort!` }
            : { winner: player2, loser: player1, details: `🃏 Tirage au sort!` };
    }
}

// ✊ ROCK PAPER SCISSORS - Both players choose! (INTERACTIVE)
async function playRPS(interaction, player1, player2) {
    const choices = [
        { name: 'Pierre', emoji: '🪨', beats: 'Ciseaux' },
        { name: 'Papier', emoji: '📄', beats: 'Pierre' },
        { name: 'Ciseaux', emoji: '✂️', beats: 'Papier' }
    ];
    
    let p1Choice = null;
    let p2Choice = null;
    
    const rpsRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('rps_pierre').setLabel('🪨 Pierre').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rps_papier').setLabel('📄 Papier').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rps_ciseaux').setLabel('✂️ Ciseaux').setStyle(ButtonStyle.Secondary)
        );
    
    const rpsMsg = await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('✊ PIERRE-PAPIER-CISEAUX!')
            .setDescription(
                `**${player1.username}** et **${player2.username}**\n\n` +
                `Choisissez en même temps!\n` +
                `🪨 Pierre • 📄 Papier • ✂️ Ciseaux\n\n` +
                `⏱️ 10 secondes pour choisir!`
            )
            .setColor(0x9932cc)],
        components: [rpsRow]
    });
    
    // Collect both choices
    const collected = { p1: null, p2: null };
    
    const collector = rpsMsg.createMessageComponentCollector({ time: 10000 });
    
    const result = await new Promise((resolve) => {
        collector.on('collect', async (i) => {
            const choice = i.customId.split('_')[1];
            const playerChoice = choices.find(c => c.name.toLowerCase() === choice);
            
            if (i.user.id === player1.id && !collected.p1) {
                collected.p1 = playerChoice;
                await i.reply({ content: `✅ Vous avez choisi **${playerChoice.emoji} ${playerChoice.name}**!`, ephemeral: true });
            } else if (i.user.id === player2.id && !collected.p2) {
                collected.p2 = playerChoice;
                await i.reply({ content: `✅ Vous avez choisi **${playerChoice.emoji} ${playerChoice.name}**!`, ephemeral: true });
            }
            
            // Update message to show who has chosen
            const p1Status = collected.p1 ? '✅' : '⏳';
            const p2Status = collected.p2 ? '✅' : '⏳';
            
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✊ PIERRE-PAPIER-CISEAUX!')
                    .setDescription(
                        `${p1Status} **${player1.username}** ${collected.p1 ? 'a choisi!' : 'réfléchit...'}\n` +
                        `${p2Status} **${player2.username}** ${collected.p2 ? 'a choisi!' : 'réfléchit...'}\n\n` +
                        `🪨 Pierre • 📄 Papier • ✂️ Ciseaux`
                    )
                    .setColor(0x9932cc)],
                components: [rpsRow]
            });
            
            if (collected.p1 && collected.p2) {
                collector.stop('both_chosen');
            }
        });
        
        collector.on('end', () => {
            resolve(collected);
        });
    });
    
    p1Choice = result.p1 || choices[Math.floor(Math.random() * 3)];
    p2Choice = result.p2 || choices[Math.floor(Math.random() * 3)];
    
    // Reveal
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('✊ RÉVÉLATION!')
            .setDescription(
                `**${player1.username}:** ${p1Choice.emoji} ${p1Choice.name}\n` +
                `**${player2.username}:** ${p2Choice.emoji} ${p2Choice.name}`
            )
            .setColor(0x9932cc)],
        components: []
    });
    
    await new Promise(r => setTimeout(r, 1500));
    
    // Determine winner
    if (p1Choice.beats === p2Choice.name) return { winner: player1, loser: player2, details: `✊ ${p1Choice.emoji} bat ${p2Choice.emoji}!` };
    if (p2Choice.beats === p1Choice.name) return { winner: player2, loser: player1, details: `✊ ${p2Choice.emoji} bat ${p1Choice.emoji}!` };
    
    // Tie - sudden death with random
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🔄 ÉGALITÉ! MORT SUBITE!')
            .setDescription('Match nul! Tirage au sort...')
            .setColor(0xffd700)]
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    return Math.random() < 0.5
        ? { winner: player1, loser: player2, details: `✊ Égalité ${p1Choice.emoji}! ${player1.username} gagne au tirage!` }
        : { winner: player2, loser: player1, details: `✊ Égalité ${p2Choice.emoji}! ${player2.username} gagne au tirage!` };
}

// ⚡ REFLEX GAME - First to click the button wins (SKILL-BASED)
async function playTargetShoot(interaction, player1, player2) {
    // Countdown phase
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('⚡ TEST DE RÉFLEXES!')
            .setDescription(
                `**${player1.username}** vs **${player2.username}**\n\n` +
                `🎯 Préparez-vous...\n` +
                `Cliquez sur le bouton **dès qu'il apparaît!**\n\n` +
                `⏳ Le bouton va apparaître dans quelques secondes...`
            )
            .setColor(0xff6600)]
    });
    
    // Random delay between 2-5 seconds to prevent prediction
    const delay = 2000 + Math.floor(Math.random() * 3000);
    await new Promise(r => setTimeout(r, delay));
    
    // Show the button - FIRST TO CLICK WINS!
    const startTime = Date.now();
    
    const reflexRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('reflex_click')
                .setLabel('⚡ CLIQUEZ!')
                .setStyle(ButtonStyle.Danger)
        );
    
    const reflexMsg = await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('⚡⚡⚡ MAINTENANT! ⚡⚡⚡')
            .setDescription('🔴 **CLIQUEZ SUR LE BOUTON!** 🔴')
            .setColor(0xff0000)],
        components: [reflexRow]
    });
    
    try {
        // Wait for first click - only 5 seconds window
        const clickInteraction = await reflexMsg.awaitMessageComponent({
            filter: i => i.user.id === player1.id || i.user.id === player2.id,
            time: 5000
        });
        
        const reactionTime = Date.now() - startTime;
        const winnerId = clickInteraction.user.id;
        const winner = winnerId === player1.id ? player1 : player2;
        const loser = winnerId === player1.id ? player2 : player1;
        
        await clickInteraction.update({
            embeds: [new EmbedBuilder()
                .setTitle('⚡ RÉFLEXES FULGURANTS!')
                .setDescription(
                    `🏆 **${winner.username}** a cliqué en premier!\n\n` +
                    `⏱️ Temps de réaction: **${reactionTime}ms**\n\n` +
                    `${reactionTime < 300 ? '🔥 INCROYABLE!' : reactionTime < 500 ? '⚡ Rapide!' : reactionTime < 800 ? '👍 Pas mal!' : '🐢 Un peu lent...'}`
                )
                .setColor(0x00ff00)],
            components: []
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        return { winner, loser, details: `⚡ ${winner.username} - ${reactionTime}ms!` };
        
    } catch (error) {
        // No one clicked in time
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('😴 TROP LENT!')
                .setDescription('Personne n\'a cliqué à temps!\nTirage au sort...')
                .setColor(0x808080)],
            components: []
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Random winner as fallback
        return Math.random() < 0.5
            ? { winner: player1, loser: player2, details: `⚡ Tirage au sort - ${player1.username}!` }
            : { winner: player2, loser: player1, details: `⚡ Tirage au sort - ${player2.username}!` };
    }
}

// 🎰 SLOTS BATTLE - Best slot combo wins
async function playSlotsBattle(interaction, player1, player2) {
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🎰 BATAILLE DE SLOTS!')
            .setDescription('Les machines s\'activent!\n🎰 Que le meilleur combo gagne!')
            .setColor(0xffd700)]
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    const symbols = ['🍒', '🍋', '🍊', '⭐', '💎', '7️⃣'];
    const getSlots = () => [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
    ];
    
    const scoreSlots = (slots) => {
        if (slots[0] === slots[1] && slots[1] === slots[2]) {
            if (slots[0] === '7️⃣') return 100;
            if (slots[0] === '💎') return 80;
            if (slots[0] === '⭐') return 60;
            return 50;
        }
        if (slots[0] === slots[1] || slots[1] === slots[2] || slots[0] === slots[2]) return 20;
        return Math.floor(Math.random() * 10);
    };
    
    const p1Slots = getSlots();
    const p2Slots = getSlots();
    const p1Score = scoreSlots(p1Slots);
    const p2Score = scoreSlots(p2Slots);
    
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🎰 RÉSULTATS!')
            .setDescription(
                `**${player1.username}:** ${p1Slots.join(' | ')} (${p1Score} pts)\n` +
                `**${player2.username}:** ${p2Slots.join(' | ')} (${p2Score} pts)`
            )
            .setColor(0xffd700)]
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    if (p1Score > p2Score) return { winner: player1, loser: player2, details: `🎰 ${p1Slots.join('')} bat ${p2Slots.join('')}!` };
    if (p2Score > p1Score) return { winner: player2, loser: player1, details: `🎰 ${p2Slots.join('')} bat ${p1Slots.join('')}!` };
    
    return Math.random() < 0.5
        ? { winner: player1, loser: player2, details: `🎰 Égalité! Relance: ${player1.username} gagne!` }
        : { winner: player2, loser: player1, details: `🎰 Égalité! Relance: ${player2.username} gagne!` };
}

// 🔢 NUMBER GUESS - Players type their guesses, closest to mystery number wins
async function playNumberGuess(interaction, player1, player2) {
    const mysteryNumber = Math.floor(Math.random() * 100) + 1;
    const channel = interaction.channel;
    
    let p1Guess = null;
    let p2Guess = null;
    
    // Ask both players to guess
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🔢 DEVINE LE NOMBRE!')
            .setDescription(
                `Un nombre mystère entre **1** et **100**!\n` +
                `Le plus proche gagne!\n\n` +
                `**${player1.username}** et **${player2.username}**,\n` +
                `tapez votre nombre dans le chat!\n\n` +
                `⏱️ **20 secondes** pour répondre!`
            )
            .setColor(0x00ced1)
            .setFooter({ text: 'Tapez un nombre entre 1 et 100' })]
    });
    
    // Collect messages from both players
    const filter = m => {
        if (m.author.id !== player1.id && m.author.id !== player2.id) return false;
        const num = parseInt(m.content);
        return !isNaN(num) && num >= 1 && num <= 100;
    };
    
    try {
        const collector = channel.createMessageCollector({ filter, time: 20000, max: 2 });
        
        const guesses = await new Promise((resolve) => {
            const collected = { p1: null, p2: null };
            
            collector.on('collect', (m) => {
                const num = parseInt(m.content);
                if (m.author.id === player1.id && collected.p1 === null) {
                    collected.p1 = num;
                    m.react('✅').catch(() => {});
                } else if (m.author.id === player2.id && collected.p2 === null) {
                    collected.p2 = num;
                    m.react('✅').catch(() => {});
                }
                
                // If both have guessed, stop early
                if (collected.p1 !== null && collected.p2 !== null) {
                    collector.stop('both_guessed');
                }
            });
            
            collector.on('end', () => {
                resolve(collected);
            });
        });
        
        p1Guess = guesses.p1;
        p2Guess = guesses.p2;
        
    } catch (error) {
        // Fallback to random
    }
    
    // Fill in random guesses for players who didn't respond
    if (p1Guess === null) p1Guess = Math.floor(Math.random() * 100) + 1;
    if (p2Guess === null) p2Guess = Math.floor(Math.random() * 100) + 1;
    
    // Show what each player guessed
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🔢 LES CHOIX SONT FAITS!')
            .setDescription(
                `**${player1.username}** a deviné: **${p1Guess}**\n` +
                `**${player2.username}** a deviné: **${p2Guess}**\n\n` +
                `🔮 Le nombre mystère est...`
            )
            .setColor(0x00ced1)]
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    const p1Diff = Math.abs(mysteryNumber - p1Guess);
    const p2Diff = Math.abs(mysteryNumber - p2Guess);
    
    // Reveal the mystery number
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle(`🔢 C'ÉTAIT ${mysteryNumber}!`)
            .setDescription(
                `**${player1.username}:** ${p1Guess} (écart: ${p1Diff}) ${p1Diff <= p2Diff ? '⭐' : ''}\n` +
                `**${player2.username}:** ${p2Guess} (écart: ${p2Diff}) ${p2Diff <= p1Diff ? '⭐' : ''}`
            )
            .setColor(0x00ced1)]
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    if (p1Diff < p2Diff) return { winner: player1, loser: player2, details: `🔢 ${p1Guess} plus proche de ${mysteryNumber}!` };
    if (p2Diff < p1Diff) return { winner: player2, loser: player1, details: `🔢 ${p2Guess} plus proche de ${mysteryNumber}!` };
    
    return Math.random() < 0.5
        ? { winner: player1, loser: player2, details: `🔢 Même écart (${p1Diff})! Tirage au sort: ${player1.username}!` }
        : { winner: player2, loser: player1, details: `🔢 Même écart (${p2Diff})! Tirage au sort: ${player2.username}!` };
}

// 💣 BOMB DEFUSE - Both players choose a wire! (INTERACTIVE)
async function playBombDefuse(interaction, player1, player2) {
    const wires = [
        { emoji: '🔴', name: 'Rouge', id: 'red' },
        { emoji: '🔵', name: 'Bleu', id: 'blue' },
        { emoji: '🟢', name: 'Vert', id: 'green' },
        { emoji: '🟡', name: 'Jaune', id: 'yellow' }
    ];
    const correctWire = wires[Math.floor(Math.random() * wires.length)];
    
    let p1Wire = null;
    let p2Wire = null;
    
    const bombRow = new ActionRowBuilder()
        .addComponents(
            ...wires.map(w => 
                new ButtonBuilder()
                    .setCustomId(`bomb_${w.id}`)
                    .setLabel(`${w.emoji} ${w.name}`)
                    .setStyle(ButtonStyle.Secondary)
            )
        );
    
    const bombMsg = await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('💣 DÉSAMORÇAGE!')
            .setDescription(
                `**BOMBE DÉTECTÉE!**\n\n` +
                `4 fils: ${wires.map(w => w.emoji).join(' ')}\n\n` +
                `**${player1.username}** et **${player2.username}**,\n` +
                `choisissez le fil à couper!\n\n` +
                `⏱️ 10 secondes avant EXPLOSION!`
            )
            .setColor(0xff0000)],
        components: [bombRow]
    });
    
    // Collect both choices
    const collected = { p1: null, p2: null };
    
    const collector = bombMsg.createMessageComponentCollector({ time: 10000 });
    
    const result = await new Promise((resolve) => {
        collector.on('collect', async (i) => {
            const wireId = i.customId.split('_')[1];
            const wire = wires.find(w => w.id === wireId);
            
            if (i.user.id === player1.id && !collected.p1) {
                collected.p1 = wire;
                await i.reply({ content: `✂️ Vous coupez le fil **${wire.emoji} ${wire.name}**!`, ephemeral: true });
            } else if (i.user.id === player2.id && !collected.p2) {
                collected.p2 = wire;
                await i.reply({ content: `✂️ Vous coupez le fil **${wire.emoji} ${wire.name}**!`, ephemeral: true });
            }
            
            // Update countdown effect
            const p1Status = collected.p1 ? '✂️' : '⏳';
            const p2Status = collected.p2 ? '✂️' : '⏳';
            
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('💣 DÉSAMORÇAGE EN COURS...')
                    .setDescription(
                        `${p1Status} **${player1.username}** ${collected.p1 ? `coupe ${collected.p1.emoji}` : 'hésite...'}\n` +
                        `${p2Status} **${player2.username}** ${collected.p2 ? `coupe ${collected.p2.emoji}` : 'hésite...'}\n\n` +
                        `💣 Tic... Tac... Tic... Tac...`
                    )
                    .setColor(0xff0000)],
                components: [bombRow]
            });
            
            if (collected.p1 && collected.p2) {
                collector.stop('both_chosen');
            }
        });
        
        collector.on('end', () => {
            resolve(collected);
        });
    });
    
    p1Wire = result.p1 || wires[Math.floor(Math.random() * wires.length)];
    p2Wire = result.p2 || wires[Math.floor(Math.random() * wires.length)];
    
    // Tension building
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('💣💣💣 RÉVÉLATION 💣💣💣')
            .setDescription(`Le bon fil était...`)
            .setColor(0xff0000)],
        components: []
    });
    
    await new Promise(r => setTimeout(r, 1500));
    
    const p1Correct = p1Wire.id === correctWire.id;
    const p2Correct = p2Wire.id === correctWire.id;
    
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle(`💣 C'ÉTAIT ${correctWire.emoji} ${correctWire.name.toUpperCase()}!`)
            .setDescription(
                `**${player1.username}:** ${p1Wire.emoji} ${p1Wire.name} ${p1Correct ? '✅ DÉSAMORCÉ!' : '💥 BOOM!'}\n` +
                `**${player2.username}:** ${p2Wire.emoji} ${p2Wire.name} ${p2Correct ? '✅ DÉSAMORCÉ!' : '💥 BOOM!'}`
            )
            .setColor(p1Correct || p2Correct ? 0x00ff00 : 0xff0000)]
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    if (p1Correct && !p2Correct) return { winner: player1, loser: player2, details: `💣 ${player1.username} a désamorcé!` };
    if (p2Correct && !p1Correct) return { winner: player2, loser: player1, details: `💣 ${player2.username} a désamorcé!` };
    
    // Both same result
    return Math.random() < 0.5
        ? { winner: player1, loser: player2, details: `💣 ${p1Correct ? 'Tous désamorcé!' : 'Tous explosé!'} ${player1.username} survit!` }
        : { winner: player2, loser: player1, details: `💣 ${p2Correct ? 'Tous désamorcé!' : 'Tous explosé!'} ${player2.username} survit!` };
}

// 🧮 MATH CHALLENGE - First to type correct answer wins (SKILL-BASED)
async function playMathChallenge(interaction, player1, player2) {
    const channel = interaction.channel;
    
    // Generate random math problem
    const operations = ['+', '-', '×'];
    const op = operations[Math.floor(Math.random() * operations.length)];
    
    let num1, num2, answer;
    
    switch (op) {
        case '+':
            num1 = Math.floor(Math.random() * 50) + 10;
            num2 = Math.floor(Math.random() * 50) + 10;
            answer = num1 + num2;
            break;
        case '-':
            num1 = Math.floor(Math.random() * 50) + 30;
            num2 = Math.floor(Math.random() * 30) + 1;
            answer = num1 - num2;
            break;
        case '×':
            num1 = Math.floor(Math.random() * 12) + 2;
            num2 = Math.floor(Math.random() * 12) + 2;
            answer = num1 * num2;
            break;
    }
    
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🧮 CALCUL MENTAL!')
            .setDescription(
                `**${player1.username}** vs **${player2.username}**\n\n` +
                `Premier à taper la bonne réponse gagne!\n\n` +
                `⏱️ Préparez-vous...`
            )
            .setColor(0x4169e1)]
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Show the problem
    const startTime = Date.now();
    
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🧮 CALCULEZ!')
            .setDescription(
                `# ${num1} ${op} ${num2} = ?\n\n` +
                `**Tapez votre réponse!**\n` +
                `⏱️ 15 secondes!`
            )
            .setColor(0xff4500)]
    });
    
    // Wait for correct answer
    const filter = m => {
        if (m.author.id !== player1.id && m.author.id !== player2.id) return false;
        return !isNaN(parseInt(m.content));
    };
    
    try {
        const collector = channel.createMessageCollector({ filter, time: 15000 });
        
        const result = await new Promise((resolve) => {
            collector.on('collect', (m) => {
                const userAnswer = parseInt(m.content);
                
                if (userAnswer === answer) {
                    const responseTime = Date.now() - startTime;
                    collector.stop('correct');
                    m.react('✅').catch(() => {});
                    resolve({ 
                        winner: m.author.id === player1.id ? player1 : player2,
                        loser: m.author.id === player1.id ? player2 : player1,
                        time: responseTime,
                        correct: true
                    });
                } else {
                    m.react('❌').catch(() => {});
                }
            });
            
            collector.on('end', (collected, reason) => {
                if (reason !== 'correct') {
                    resolve({ correct: false });
                }
            });
        });
        
        if (result.correct) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🧮 CORRECT!')
                    .setDescription(
                        `**${num1} ${op} ${num2} = ${answer}**\n\n` +
                        `🏆 **${result.winner.username}** a trouvé en **${result.time}ms**!\n\n` +
                        `${result.time < 2000 ? '🔥 GÉNIE!' : result.time < 4000 ? '⚡ Rapide!' : result.time < 6000 ? '👍 Bien!' : '🐢 Pas mal!'}`
                    )
                    .setColor(0x00ff00)]
            });
            
            await new Promise(r => setTimeout(r, 1000));
            return { winner: result.winner, loser: result.loser, details: `🧮 ${result.winner.username} - ${result.time}ms!` };
        }
        
        // No one got it right
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('🧮 TEMPS ÉCOULÉ!')
                .setDescription(
                    `**${num1} ${op} ${num2} = ${answer}**\n\n` +
                    `Personne n'a trouvé! Tirage au sort...`
                )
                .setColor(0xff6600)]
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        return Math.random() < 0.5
            ? { winner: player1, loser: player2, details: `🧮 Tirage au sort - ${player1.username}!` }
            : { winner: player2, loser: player1, details: `🧮 Tirage au sort - ${player2.username}!` };
            
    } catch (error) {
        return Math.random() < 0.5
            ? { winner: player1, loser: player2, details: `🧮 Erreur - ${player1.username}!` }
            : { winner: player2, loser: player1, details: `🧮 Erreur - ${player2.username}!` };
    }
}

// Main function to play a random minigame
async function playRandomMinigame(interaction, player1, player2) {
    const minigame = getRandomMinigame();
    
    // Announce the minigame
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle(`🎮 MINI-JEU: ${minigame.name}`)
            .setDescription(minigame.description)
            .setColor(0xff4500)]
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Play the selected minigame
    switch (minigame.id) {
        case 'dice_battle':
            return await playDiceBattle(interaction, player1, player2);
        case 'horse_race':
            return await playHorseRace(interaction, player1, player2);
        case 'card_draw':
            return await playCardDraw(interaction, player1, player2);
        case 'rps':
            return await playRPS(interaction, player1, player2);
        case 'target':
            return await playTargetShoot(interaction, player1, player2);
        case 'slots_battle':
            return await playSlotsBattle(interaction, player1, player2);
        case 'number_guess':
            return await playNumberGuess(interaction, player1, player2);
        case 'bomb_defuse':
            return await playBombDefuse(interaction, player1, player2);
        case 'math_challenge':
            return await playMathChallenge(interaction, player1, player2);
        default:
            return await playDiceBattle(interaction, player1, player2);
    }
}

// ==================== DUEL COMMAND ====================

export async function duelCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length < 2 || !message.mentions.users.first()) {
        await message.reply('⚔️ **Utilisation:** `$duel <@joueur> <montant>`\n💡 Exemple: `$duel @ami 500`');
        return;
    }
    
    const opponent = message.mentions.users.first();
    const betAmount = parseInt(args[1]);
    
    if (opponent.id === userId) {
        await message.reply('❌ Vous ne pouvez pas vous défier vous-même!');
        return;
    }
    
    if (opponent.bot) {
        await message.reply('❌ Vous ne pouvez pas défier un bot!');
        return;
    }
    
    if (isNaN(betAmount) || betAmount <= 0) {
        await message.reply('❌ Montant invalide!');
        return;
    }
    
    const challengerBalance = await getBalance(userId, guildId);
    const opponentBalance = await getBalance(opponent.id, guildId);
    
    if (challengerBalance < betAmount) {
        await message.reply(`❌ Vous n'avez pas assez de coins! (${challengerBalance.toLocaleString()})`);
        return;
    }
    
    if (opponentBalance < betAmount) {
        await message.reply(`❌ ${opponent.username} n'a pas assez de coins! (${opponentBalance.toLocaleString()})`);
        return;
    }
    
    // Create duel request
    const duelEmbed = new EmbedBuilder()
        .setTitle('⚔️ DÉFI EN DUEL!')
        .setDescription(
            `**${message.author.username}** défie **${opponent.username}**!\n\n` +
            `💰 **Mise:** ${betAmount.toLocaleString()} coins chacun\n` +
            `🏆 **Prix:** ${(betAmount * 2).toLocaleString()} coins au gagnant!\n\n` +
            `${opponent}, acceptez-vous le duel?`
        )
        .setColor(0xff4500)
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('duel_accept')
                .setLabel('⚔️ Accepter')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('duel_decline')
                .setLabel('🏃 Refuser')
                .setStyle(ButtonStyle.Danger)
        );
    
    const reply = await message.reply({ embeds: [duelEmbed], components: [row] });
    
    try {
        const interaction = await reply.awaitMessageComponent({
            filter: i => i.user.id === opponent.id,
            time: 30000
        });
        
        if (interaction.customId === 'duel_decline') {
            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('🏃 Duel Refusé')
                    .setDescription(`${opponent.username} a refusé le duel!`)
                    .setColor(0x808080)],
                components: []
            });
            return;
        }
        
        // Duel accepted! Remove coins from both
        await removeMoney(userId, guildId, betAmount, 'duel_bet', `Duel contre ${opponent.username}`);
        await removeMoney(opponent.id, guildId, betAmount, 'duel_bet', `Duel contre ${message.author.username}`);
        
        // Start duel
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('⚔️ LE DUEL COMMENCE!')
                .setDescription('🎮 **Sélection du mini-jeu...**')
                .setColor(0xff4500)],
            components: []
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Play a random minigame!
        const player1 = { id: userId, username: message.author.username };
        const player2 = { id: opponent.id, username: opponent.username };
        
        const gameResult = await playRandomMinigame(interaction, player1, player2);
        
        // Determine prize with chaos chance
        const chaosChance = Math.random() < 0.08;
        let totalPrize = betAmount * 2;
        let chaosText = '';
        
        if (chaosChance) {
            const chaosRoll = Math.random();
            if (chaosRoll < 0.25) {
                // Both get their money back!
                await addMoney(userId, guildId, betAmount, 'duel_chaos', 'Duel: Chaos draw');
                await addMoney(opponent.id, guildId, betAmount, 'duel_chaos', 'Duel: Chaos draw');
                
                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('🌀 CHAOS: ANNULATION!')
                        .setDescription(
                            `**Le chaos s'en mêle!**\n` +
                            `Malgré la victoire de **${gameResult.winner.username}**, les deux joueurs récupèrent leur mise!\n\n` +
                            `🎮 ${gameResult.details}`
                        )
                        .setColor(0x9400d3)]
                });
                return;
            } else if (chaosRoll < 0.50) {
                // Bonus prize!
                totalPrize = Math.floor(betAmount * 3);
                chaosText = '\n\n🎁 **BONUS CHAOS:** Prix triplé!';
            } else if (chaosRoll < 0.75) {
                // House takes a cut
                totalPrize = Math.floor(betAmount * 1.5);
                chaosText = '\n\n👹 **Événement:** La maison prend sa part...';
            } else {
                // MEGA bonus
                totalPrize = Math.floor(betAmount * 5);
                chaosText = '\n\n🌟 **MEGA BONUS:** Prix x5!';
            }
        }
        
        await addMoney(gameResult.winner.id, guildId, totalPrize, 'duel_win', `Victoire duel: ${totalPrize}`);
        
        // 15% chance for bonus dice roll for the winner!
        let bonusDiceText = '';
        if (Math.random() < 0.15) {
            const bonusDice = await rollBonusDice(gameResult.winner.id, guildId);
            bonusDiceText = `\n\n🎲 **DÉ BONUS!** ${bonusDice.message}`;
        }
        
        const resultEmbed = new EmbedBuilder()
            .setTitle(`🏆 ${gameResult.winner.username.toUpperCase()} REMPORTE LE DUEL!`)
            .setDescription(
                `🎮 ${gameResult.details}\n\n` +
                `**${gameResult.winner.username}** gagne contre **${gameResult.loser.username}**!\n` +
                `💰 **Prix:** ${totalPrize.toLocaleString()} coins!` +
                chaosText +
                bonusDiceText
            )
            .setColor(0x00ff00)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [resultEmbed] });
        
    } catch (error) {
        await reply.edit({
            embeds: [new EmbedBuilder()
                .setTitle('⏰ Temps écoulé')
                .setDescription(`${opponent.username} n'a pas répondu à temps!`)
                .setColor(0x808080)],
            components: []
        });
    }
}

// ==================== BOWSER CASINO ====================

export async function bowserCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('👹 BOWSER CASINO')
            .setDescription(
                '**⚠️ DANGER: Casino à haut risque!**\n\n' +
                '🎰 Misez votre argent, mais Bowser peut:\n' +
                '• Multiplier vos gains (x2 à x5)\n' +
                '• Voler PLUS que votre mise!\n' +
                '• Déclencher des événements chaotiques!\n\n' +
                '**Utilisation:** `$bowser <montant>`\n' +
                '💀 **Vous avez été prévenu!**'
            )
            .setColor(0x8b0000)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    const betAmount = parseInt(args[0]);
    
    if (isNaN(betAmount) || betAmount <= 0) {
        await message.reply('❌ Montant invalide!');
        return;
    }
    
    const balance = await getBalance(userId, guildId);
    if (balance < betAmount) {
        await message.reply(`❌ Solde insuffisant! Vous avez **${balance.toLocaleString()}** coins.`);
        return;
    }
    
    await removeMoney(userId, guildId, betAmount, 'bowser_bet', `Mise Bowser: ${betAmount}`);
    
    // Bowser animation
    const bowserEmbed = new EmbedBuilder()
        .setTitle('👹 BOWSER VOUS OBSERVE...')
        .setDescription('🔥 **GWAHAHAHA!**')
        .setColor(0x8b0000);
    
    const reply = await message.reply({ embeds: [bowserEmbed] });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await reply.edit({ embeds: [EmbedBuilder.from(bowserEmbed).setDescription('👀 **Il réfléchit...**')] });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await reply.edit({ embeds: [EmbedBuilder.from(bowserEmbed).setDescription('🎲 **Le destin est scellé!**')] });
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Bowser's decision (weighted)
    const roll = Math.random();
    let finalBalance;
    let title, description, color;
    
    if (roll < 0.15) {
        // BIG WIN (15%)
        const multiplier = 3 + Math.random() * 2; // 3x to 5x
        const winAmount = Math.floor(betAmount * multiplier);
        await addMoney(userId, guildId, winAmount, 'bowser_win', `Bowser généreux: ${winAmount}`);
        finalBalance = await getBalance(userId, guildId);
        title = '😈 BOWSER EST GÉNÉREUX!';
        description = `**"Prends ça, mortel!"**\n\n💰 Vous gagnez **${winAmount.toLocaleString()}** coins! (x${multiplier.toFixed(1)})`;
        color = 0x00ff00;
    } else if (roll < 0.35) {
        // Small win (20%)
        const winAmount = Math.floor(betAmount * 1.5);
        await addMoney(userId, guildId, winAmount, 'bowser_win', `Bowser: ${winAmount}`);
        finalBalance = await getBalance(userId, guildId);
        title = '👹 Bowser grogne...';
        description = `**"Tu as de la chance..."**\n\n💰 Vous gagnez **${winAmount.toLocaleString()}** coins!`;
        color = 0x90ee90;
    } else if (roll < 0.55) {
        // Nothing (20%)
        finalBalance = await getBalance(userId, guildId);
        title = '👹 Bowser baille...';
        description = `**"Ennuyeux..."**\n\nVous perdez votre mise de **${betAmount.toLocaleString()}** coins.`;
        color = 0xff6347;
    } else if (roll < 0.75) {
        // Lose more (20%)
        const extraLoss = Math.floor(betAmount * 0.5);
        const currentBal = await getBalance(userId, guildId);
        const actualLoss = Math.min(extraLoss, currentBal);
        if (actualLoss > 0) {
            await removeMoney(userId, guildId, actualLoss, 'bowser_tax', 'Taxe Bowser');
        }
        finalBalance = await getBalance(userId, guildId);
        title = '🔥 BOWSER ATTAQUE!';
        description = `**"GWAHAHAHA!"**\n\n💀 Vous perdez **${(betAmount + actualLoss).toLocaleString()}** coins!`;
        color = 0xff0000;
    } else if (roll < 0.90) {
        // Bowser event (15%)
        const event = getRandomBowserEvent();
        let effect = '';
        
        if (event.effect === 'generous') {
            await addMoney(userId, guildId, 500 + betAmount, 'bowser_event', event.name);
            effect = `+${(500 + betAmount).toLocaleString()} coins!`;
        } else if (event.percent) {
            const currentBal = await getBalance(userId, guildId);
            const loss = Math.floor(currentBal * event.percent / 100);
            if (loss > 0) await removeMoney(userId, guildId, loss, 'bowser_event', event.name);
            effect = `-${loss.toLocaleString()} coins!`;
        } else {
            effect = 'Effet mystérieux...';
        }
        
        finalBalance = await getBalance(userId, guildId);
        title = `💀 ${event.name}`;
        description = `${event.description}\n\n${effect}`;
        color = 0x8b0000;
    } else {
        // CATASTROPHE (10%)
        const currentBal = await getBalance(userId, guildId);
        const catastropheLoss = Math.floor(currentBal * 0.5);
        if (catastropheLoss > 0) {
            await removeMoney(userId, guildId, catastropheLoss, 'bowser_catastrophe', 'Catastrophe Bowser');
        }
        finalBalance = await getBalance(userId, guildId);
        title = '☠️ CATASTROPHE BOWSER!';
        description = `**"TOUT SERA À MOI!"**\n\n💀 Bowser vole **50%** de votre solde!\n-${catastropheLoss.toLocaleString()} coins!`;
        color = 0x000000;
    }
    
    const finalEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .addFields(
            { name: '💵 Solde', value: `**${finalBalance.toLocaleString()}** coins`, inline: true }
        )
        .setColor(color)
        .setFooter({ text: 'Le Bowser Casino est impitoyable!' })
        .setTimestamp();
    
    await reply.edit({ embeds: [finalEmbed] });
}

// ==================== BONUS DICE (internal helper, not a command) ====================

// Returns bonus dice result for use in other games (15% trigger chance in duels)
async function rollBonusDice(userId, guildId) {
    const roll = Math.floor(Math.random() * 6) + 1;
    const diceEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
    
    let reward = 0;
    let message = '';
    
    switch (roll) {
        case 1:
            message = `🎲 ${diceEmojis[0]} Pas de bonus...`;
            break;
        case 2:
            reward = 50;
            message = `🎲 ${diceEmojis[1]} Bonus: **+${reward}** coins!`;
            break;
        case 3:
            reward = 100;
            message = `🎲 ${diceEmojis[2]} Bonus: **+${reward}** coins!`;
            break;
        case 4:
            reward = 200;
            message = `🎲 ${diceEmojis[3]} Bonus: **+${reward}** coins!`;
            break;
        case 5:
            reward = 500;
            message = `🎲 ${diceEmojis[4]} Bonus: **+${reward}** coins!`;
            break;
        case 6:
            reward = 1000;
            message = `🎲 ${diceEmojis[5]} JACKPOT BONUS: **+${reward}** coins!`;
            break;
    }
    
    if (reward > 0) {
        await addMoney(userId, guildId, reward, 'bonus_dice', `Dé bonus: ${reward}`);
    }
    
    return { roll, reward, message, emoji: diceEmojis[roll - 1] };
}

// ==================== ALL-IN COMMAND ====================

export async function allinCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const balance = await getBalance(userId, guildId);
    
    if (balance <= 0) {
        await message.reply('❌ Vous n\'avez pas d\'argent à miser!');
        return;
    }
    
    // Use slots with all balance
    await slotsCommand(message, [balance.toString()]);
}
