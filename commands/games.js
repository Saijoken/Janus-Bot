import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Store active PFC games with timeout
const activeGames = new Map();

// Game timeout: 60 seconds
const GAME_TIMEOUT = 60000;

/**
 * Clean up expired games
 */
function cleanupExpiredGames() {
    const now = Date.now();
    for (const [gameId, game] of activeGames.entries()) {
        if (now > game.expiresAt) {
            activeGames.delete(gameId);
        }
    }
}

// Removed getGameId - we now use messageId directly as the key

/**
 * Roll command - Pile ou Face (Heads or Tails)
 */
export async function rollCommand(message) {
    // Generate random result: true = Pile (Heads), false = Face (Tails)
    const result = Math.random() < 0.5;
    const isPile = result;
    
    // French labels
    const resultText = isPile ? '🪙 **Pile**' : '🪙 **Face**';
    const emoji = isPile ? '🪙' : '🪙';
    
    const embed = new EmbedBuilder()
        .setTitle('🎲 Pile ou Face')
        .setDescription(`${emoji} Le résultat est: ${resultText}`)
        .setColor(0x3498db)
        .setFooter({ text: `Lancé par ${message.author.username}` })
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Pierre-Feuille-Ciseaux command - Rock Paper Scissors with buttons
 * Usage: $pfc [@user] - Play against bot or challenge a user
 */
export async function pfcCommand(message, args) {
    // Clean up expired games first
    cleanupExpiredGames();
    
    const emojis = {
        'pierre': '🪨',
        'feuille': '📄',
        'ciseaux': '✂️'
    };
    
    // Check if user wants to challenge someone
    const mentionedUser = message.mentions.users.first();
    
    // Validate: can't challenge yourself
    if (mentionedUser && mentionedUser.id === message.author.id) {
        await message.reply('❌ Vous ne pouvez pas vous défier vous-même !');
        return;
    }
    
    // Validate: can't challenge a bot (except if it's the game bot itself)
    if (mentionedUser && mentionedUser.bot) {
        await message.reply('❌ Vous ne pouvez pas défier un bot !');
        return;
    }
    
    // Create buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pfc_pierre')
                .setLabel('Pierre')
                .setEmoji('🪨')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('pfc_feuille')
                .setLabel('Feuille')
                .setEmoji('📄')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('pfc_ciseaux')
                .setLabel('Ciseaux')
                .setEmoji('✂️')
                .setStyle(ButtonStyle.Primary)
        );
    
    let embed;
    let gameType;
    
    if (mentionedUser) {
        // Duel mode
        gameType = 'duel';
        embed = new EmbedBuilder()
            .setTitle('🪨📄✂️ Défi Pierre-Feuille-Ciseaux')
            .setDescription(
                `**${message.author.username}** a défié **${mentionedUser.username}** !\n\n` +
                `⏱️ Vous avez **60 secondes** pour jouer.\n` +
                `Chacun doit choisir son coup en cliquant sur un bouton.`
            )
            .setColor(0x3498db)
            .setFooter({ text: 'Les deux joueurs doivent choisir leur coup' })
            .setTimestamp();
    } else {
        // Solo mode (against bot)
        gameType = 'solo';
        embed = new EmbedBuilder()
            .setTitle('🪨📄✂️ Pierre-Feuille-Ciseaux')
            .setDescription(`**${message.author.username}**, choisissez votre coup !`)
            .setColor(0x3498db)
            .setFooter({ text: 'Cliquez sur un bouton pour jouer' })
            .setTimestamp();
    }
    
    const reply = await message.reply({ embeds: [embed], components: [row] });
    
    // Create game entry AFTER getting reply.id for duel games
    if (gameType === 'duel') {
        // Check if challenger already has an active game
        for (const [gameId, game] of activeGames.entries()) {
            if (game.challenger === message.author.id && game.type === 'duel' && Date.now() < game.expiresAt) {
                await reply.edit({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Partie déjà en cours')
                        .setDescription('Vous avez déjà une partie en cours ! Attendez qu\'elle se termine.')
                        .setColor(0xff0000)
                        .setTimestamp()],
                    components: []
                });
                return;
            }
        }
        
        // Use reply.id as the messageId (the message with buttons)
        const gameId = reply.id;
        
        // Create game entry with reply message ID
        activeGames.set(gameId, {
            type: 'duel',
            challenger: message.author.id,
            opponent: mentionedUser.id,
            challengerChoice: null,
            opponentChoice: null,
            messageId: reply.id, // Use reply.id, not message.id
            createdAt: Date.now(),
            expiresAt: Date.now() + GAME_TIMEOUT
        });
        
        // Set timeout for duel games
        setTimeout(() => {
            const game = activeGames.get(gameId);
            if (game && (game.challengerChoice === null || game.opponentChoice === null)) {
                activeGames.delete(gameId);
                // Try to update the message if it still exists
                reply.edit({
                    embeds: [new EmbedBuilder()
                        .setTitle('⏱️ Partie expirée')
                        .setDescription('Le temps est écoulé. La partie a été annulée.')
                        .setColor(0xff0000)
                        .setTimestamp()],
                    components: []
                }).catch(() => {
                    // Message might have been deleted, ignore
                });
            }
        }, GAME_TIMEOUT);
    }
}

/**
 * Handle PFC button interaction
 */
export function handlePFCInteraction(interaction, userChoice) {
    // Clean up expired games first
    cleanupExpiredGames();
    
    const emojis = {
        'pierre': '🪨',
        'feuille': '📄',
        'ciseaux': '✂️'
    };
    
    const messageId = interaction.message.id;
    const userId = interaction.user.id;
    
    // Get game directly by messageId (which is the key)
    const game = activeGames.get(messageId);
    const gameId = messageId;
    
    // If no active game found, treat as solo game (against bot)
    if (!game || game.type === 'solo' || Date.now() > game.expiresAt) {
        // Solo mode - play against bot
        const choices = ['pierre', 'feuille', 'ciseaux'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        
        let resultText;
        let color;
        
        if (userChoice === botChoice) {
            resultText = '🤝 **Égalité !**';
            color = 0xffa500; // Orange
        } else if (
            (userChoice === 'pierre' && botChoice === 'ciseaux') ||
            (userChoice === 'feuille' && botChoice === 'pierre') ||
            (userChoice === 'ciseaux' && botChoice === 'feuille')
        ) {
            resultText = '🎉 **Vous avez gagné !**';
            color = 0x00ff00; // Green
        } else {
            resultText = '😢 **Vous avez perdu !**';
            color = 0xff0000; // Red
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🪨📄✂️ Résultat')
            .setDescription(
                `${resultText}\n\n` +
                `**Vous:** ${emojis[userChoice]} ${userChoice.charAt(0).toUpperCase() + userChoice.slice(1)}\n` +
                `**Bot:** ${emojis[botChoice]} ${botChoice.charAt(0).toUpperCase() + botChoice.slice(1)}`
            )
            .setColor(color)
            .setFooter({ text: `Joué par ${interaction.user.username}` })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pfc_pierre')
                    .setLabel('Pierre')
                    .setEmoji('🪨')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('pfc_feuille')
                    .setLabel('Feuille')
                    .setEmoji('📄')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('pfc_ciseaux')
                    .setLabel('Ciseaux')
                    .setEmoji('✂️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true)
            );
        
        return { embeds: [embed], components: [row] };
    }
    
    // Duel mode
    if (game.type === 'duel') {
        // Check if user is part of this game
        if (userId !== game.challenger && userId !== game.opponent) {
            return { 
                content: '❌ Vous n\'êtes pas autorisé à jouer dans cette partie !', 
                ephemeral: true 
            };
        }
        
        // Check if game expired
        if (Date.now() > game.expiresAt) {
            activeGames.delete(gameId);
            return {
                content: '❌ Cette partie a expiré !',
                ephemeral: true
            };
        }
        
        // Record choice
        if (userId === game.challenger) {
            if (game.challengerChoice !== null) {
                return {
                    content: '❌ Vous avez déjà choisi votre coup !',
                    ephemeral: true
                };
            }
            game.challengerChoice = userChoice;
        } else if (userId === game.opponent) {
            if (game.opponentChoice !== null) {
                return {
                    content: '❌ Vous avez déjà choisi votre coup !',
                    ephemeral: true
                };
            }
            game.opponentChoice = userChoice;
        }
        
        // Check if both players have chosen
        if (game.challengerChoice !== null && game.opponentChoice !== null) {
            // Both players have chosen - determine winner
            const challengerWins = (
                (game.challengerChoice === 'pierre' && game.opponentChoice === 'ciseaux') ||
                (game.challengerChoice === 'feuille' && game.opponentChoice === 'pierre') ||
                (game.challengerChoice === 'ciseaux' && game.opponentChoice === 'feuille')
            );
            
            const opponentWins = (
                (game.opponentChoice === 'pierre' && game.challengerChoice === 'ciseaux') ||
                (game.opponentChoice === 'feuille' && game.challengerChoice === 'pierre') ||
                (game.opponentChoice === 'ciseaux' && game.challengerChoice === 'feuille')
            );
            
            let resultText;
            let color;
            
            if (game.challengerChoice === game.opponentChoice) {
                resultText = '🤝 **Égalité !**';
                color = 0xffa500; // Orange
            } else if (challengerWins) {
                resultText = `🎉 **<@${game.challenger}> a gagné !**`;
                color = 0x00ff00; // Green
            } else {
                resultText = `🎉 **<@${game.opponent}> a gagné !**`;
                color = 0x00ff00; // Green
            }
            
            // Get user objects for display
            const challengerName = interaction.guild.members.cache.get(game.challenger)?.user?.username || 'Joueur 1';
            const opponentName = interaction.guild.members.cache.get(game.opponent)?.user?.username || 'Joueur 2';
            
            const embed = new EmbedBuilder()
                .setTitle('🪨📄✂️ Résultat du Duel')
                .setDescription(
                    `${resultText}\n\n` +
                    `**${challengerName}:** ${emojis[game.challengerChoice]} ${game.challengerChoice.charAt(0).toUpperCase() + game.challengerChoice.slice(1)}\n` +
                    `**${opponentName}:** ${emojis[game.opponentChoice]} ${game.opponentChoice.charAt(0).toUpperCase() + game.opponentChoice.slice(1)}`
                )
                .setColor(color)
                .setTimestamp();
            
            // Remove game from active games
            activeGames.delete(gameId);
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pfc_pierre')
                        .setLabel('Pierre')
                        .setEmoji('🪨')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('pfc_feuille')
                        .setLabel('Feuille')
                        .setEmoji('📄')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('pfc_ciseaux')
                        .setLabel('Ciseaux')
                        .setEmoji('✂️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                );
            
            return { embeds: [embed], components: [row] };
        } else {
            // One player has chosen, waiting for the other
            // Don't reveal the choice until both have chosen
            const waitingFor = userId === game.challenger 
                ? `<@${game.opponent}>` 
                : `<@${game.challenger}>`;
            
            // Get user objects for display
            const challengerName = interaction.guild.members.cache.get(game.challenger)?.user?.username || 'Joueur 1';
            const opponentName = interaction.guild.members.cache.get(game.opponent)?.user?.username || 'Joueur 2';
            
            // Show who has chosen (but not what they chose) and who is waiting
            const whoChose = userId === game.challenger ? challengerName : opponentName;
            const statusText = `✅ **${whoChose}** a choisi son coup\n⏳ En attente de ${waitingFor}...`;
            
            const embed = new EmbedBuilder()
                .setTitle('🪨📄✂️ Défi en cours')
                .setDescription(statusText)
                .setColor(0x3498db)
                .setTimestamp();
            
            // Keep buttons active for the other player
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pfc_pierre')
                        .setLabel('Pierre')
                        .setEmoji('🪨')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('pfc_feuille')
                        .setLabel('Feuille')
                        .setEmoji('📄')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('pfc_ciseaux')
                        .setLabel('Ciseaux')
                        .setEmoji('✂️')
                        .setStyle(ButtonStyle.Primary)
                );
            
            return { embeds: [embed], components: [row] };
        }
    }
    
    // Fallback (shouldn't reach here)
    return { content: '❌ Erreur inattendue', ephemeral: true };
}

/**
 * Say command - Echo user's message 
 */
export async function sayCommand(message, args) {
    /*const TARGET_USER_ID = '396296915777486850';
    
    // Check if user is the target user
    if (message.author.id === TARGET_USER_ID) {
        await message.reply('va te faire foutre fdp');
        return;
    }
    */
    // For other users, echo their message
    const text = args.join(' ');
    
    if (!text) {
        await message.reply('❌ Veuillez fournir un message à répéter.');
        return;
    }
    
    await message.reply(text);
}
