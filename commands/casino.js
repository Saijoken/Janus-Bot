import {
    getBalance,
    addMoney,
    removeMoney
} from '../database.js';
import { EmbedBuilder } from 'discord.js';

// Slot machine symbols with emojis
const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '💎', '7️⃣'];

// Payout multipliers for different combinations
const PAYOUTS = {
    'triple': 3.0,      // Three of a kind
    'double': 1.5,      // Two of a kind
    'none': 0           // No match
};

/**
 * Get random slot symbol
 */
function getRandomSymbol() {
    return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
}

/**
 * Calculate payout based on symbols
 */
function calculatePayout(symbols, bet) {
    const [a, b, c] = symbols;
    
    // Triple match (jackpot!)
    if (a === b && b === c) {
        // Special bonus for 7️⃣ and 💎
        if (a === '7️⃣') {
            return { type: 'triple', multiplier: 5.0, win: true };
        } else if (a === '💎') {
            return { type: 'triple', multiplier: 4.0, win: true };
        } else if (a === '⭐') {
            return { type: 'triple', multiplier: 3.5, win: true };
        }
        return { type: 'triple', multiplier: 3.0, win: true };
    }
    
    // Double match
    if (a === b || b === c || a === c) {
        return { type: 'double', multiplier: 1.5, win: true };
    }
    
    // No match - but we want ~50% win rate overall
    // Calculate approximate win rate so far:
    // - Triple: ~1.5% chance (very rare)
    // - Double: ~4% chance
    // Total so far: ~5.5% chance of winning
    // To reach ~50%, we need ~44.5% more wins from "near miss"
    // Since no-match happens ~94.5% of the time, we need ~47% chance of near miss win
    const randomChance = Math.random();
    if (randomChance < 0.47) {
        // ~47% chance of small win even with no match (to balance to ~50% overall)
        return { type: 'near_miss', multiplier: 0.8, win: true };
    }
    
    return { type: 'none', multiplier: 0, win: false };
}

/**
 * Casino slot machine command
 */
export async function casinoCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Parse bet amount
    if (args.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('🎰 Machine à Sous')
            .setDescription(
                '**Utilisation:** `$casino [montant]`\n\n' +
                '**Exemples:**\n' +
                '• `$casino 100` - Miser 100 coins\n' +
                '• `$casino 500` - Miser 500 coins\n\n' +
                '🎲 **Règles:**\n' +
                '• **Triple identique** : x3 à x5 (selon le symbole)\n' +
                '• **Double identique** : x1.5\n' +
                '• **Presque gagné** : x0.8 (petit gain)\n' +
                '• **Aucun match** : Perte de la mise\n\n' +
                '💡 **Astuce:** Les symboles 💎, ⭐ et 7️⃣ offrent des multiplicateurs bonus !'
            )
            .setColor(0xffd700)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    const betAmount = parseInt(args[0]);
    
    // Validate bet amount
    if (isNaN(betAmount) || betAmount <= 0) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Montant invalide')
            .setDescription('Veuillez entrer un montant valide supérieur à 0.')
            .setColor(0xff0000)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Check balance
    const balance = await getBalance(userId, guildId);
    if (balance < betAmount) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Solde insuffisant')
            .setDescription(
                `Vous n'avez pas assez de coins !\n\n` +
                `💰 Votre solde: **${balance.toLocaleString()}** coins\n` +
                `🎰 Mise requise: **${betAmount.toLocaleString()}** coins`
            )
            .setColor(0xff0000)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Remove bet amount first
    const newBalance = await removeMoney(userId, guildId, betAmount, 'casino_bet', `Mise casino: ${betAmount}`);
    
    // Create initial embed with spinning animation
    const initialEmbed = new EmbedBuilder()
        .setTitle('🎰 Machine à Sous - En cours...')
        .setDescription('🎲 **Tirage en cours...**')
        .addFields(
            { name: '🎰 Rouleaux', value: '🔄 | 🔄 | 🔄', inline: false },
            { name: '💰 Mise', value: `**${betAmount.toLocaleString()}** coins`, inline: true },
            { name: '💵 Solde', value: `**${newBalance.toLocaleString()}** coins`, inline: true }
        )
        .setColor(0xffd700)
        .setFooter({ text: 'Les rouleaux tournent...' })
        .setTimestamp();
    
    const reply = await message.reply({ embeds: [initialEmbed] });
    
    // Simulate spinning animation (3 steps)
    const spinSteps = 3;
    for (let i = 0; i < spinSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        
        const tempSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
        const tempEmbed = new EmbedBuilder()
            .setTitle('🎰 Machine à Sous - En cours...')
            .setDescription('🎲 **Tirage en cours...**')
            .addFields(
                { name: '🎰 Rouleaux', value: `${tempSymbols[0]} | ${tempSymbols[1]} | ${tempSymbols[2]}`, inline: false },
                { name: '💰 Mise', value: `**${betAmount.toLocaleString()}** coins`, inline: true },
                { name: '💵 Solde', value: `**${newBalance.toLocaleString()}** coins`, inline: true }
            )
            .setColor(0xffd700)
            .setFooter({ text: 'Les rouleaux tournent...' })
            .setTimestamp();
        
        await reply.edit({ embeds: [tempEmbed] });
    }
    
    // Final spin result
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const finalSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const result = calculatePayout(finalSymbols, betAmount);
    
    let finalBalance = newBalance;
    let winAmount = 0;
    let title = '';
    let description = '';
    let color = 0xff0000; // Red for loss
    
    if (result.win) {
        winAmount = Math.floor(betAmount * result.multiplier);
        finalBalance = await addMoney(userId, guildId, winAmount, 'casino_win', `Gain casino: ${winAmount}`);
        
        // Determine title and description based on result type
        if (result.type === 'triple') {
            if (finalSymbols[0] === '7️⃣') {
                title = '🎉 JACKPOT TRIPLE 7️⃣ !';
                description = `**${message.author.username}**, vous avez gagné le JACKPOT avec trois 7️⃣ !\n\n` +
                             `💰 **Gain:** ${winAmount.toLocaleString()} coins (x${result.multiplier})`;
                color = 0xffd700; // Gold
            } else if (finalSymbols[0] === '💎') {
                title = '💎 TRIPLE DIAMANT !';
                description = `**${message.author.username}**, trois diamants 💎 ! Incroyable !\n\n` +
                             `💰 **Gain:** ${winAmount.toLocaleString()} coins (x${result.multiplier})`;
                color = 0x00ffff; // Cyan
            } else if (finalSymbols[0] === '⭐') {
                title = '⭐ TRIPLE ÉTOILE !';
                description = `**${message.author.username}**, trois étoiles ⭐ ! Fantastique !\n\n` +
                             `💰 **Gain:** ${winAmount.toLocaleString()} coins (x${result.multiplier})`;
                color = 0xffff00; // Yellow
            } else {
                title = '🎉 TRIPLE GAGNANT !';
                description = `**${message.author.username}**, trois symboles identiques !\n\n` +
                             `💰 **Gain:** ${winAmount.toLocaleString()} coins (x${result.multiplier})`;
                color = 0x00ff00; // Green
            }
        } else if (result.type === 'double') {
            title = '🎯 DOUBLE GAGNANT !';
            description = `**${message.author.username}**, deux symboles identiques !\n\n` +
                         `💰 **Gain:** ${winAmount.toLocaleString()} coins (x${result.multiplier})`;
            color = 0x00ff00; // Green
        } else {
            title = '🍀 Presque gagné !';
            description = `**${message.author.username}**, vous avez eu de la chance !\n\n` +
                         `💰 **Gain:** ${winAmount.toLocaleString()} coins (x${result.multiplier})`;
            color = 0x90ee90; // Light green
        }
    } else {
        title = '❌ Pas de chance...';
        description = `**${message.author.username}**, aucun match cette fois !\n\n` +
                     `💸 **Perte:** ${betAmount.toLocaleString()} coins`;
        color = 0xff0000; // Red
    }
    
    const finalEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .addFields(
            { name: '🎰 Résultat', value: `${finalSymbols[0]} | ${finalSymbols[1]} | ${finalSymbols[2]}`, inline: false },
            { name: '💰 Mise', value: `**${betAmount.toLocaleString()}** coins`, inline: true },
            { name: '💵 Nouveau solde', value: `**${finalBalance.toLocaleString()}** coins`, inline: true }
        )
        .setColor(color)
        .setFooter({ text: result.win ? 'Félicitations !' : 'Bonne chance pour la prochaine fois !' })
        .setTimestamp();
    
    await reply.edit({ embeds: [finalEmbed] });
}
