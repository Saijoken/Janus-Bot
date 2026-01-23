import dotenv from 'dotenv';
dotenv.config();

// Import opusscript for Opus encoding/decoding support in voice channels
// This must be imported before @discordjs/voice is used
import 'opusscript';

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { 
    closeDatabase, 
    setVoiceJoinTime, 
    clearVoiceJoinTime, 
    checkVoiceReward,
    migrateInventoryToCollection
} from './database.js';
import * as economyCommands from './commands/economy.js';
import * as soundboardCommands from './commands/soundboard.js';
import * as gamesCommands from './commands/games.js';
import * as fishingCommands from './commands/fishing.js';
import * as casinoCommands from './commands/casino.js';
import * as musicCommands from './commands/music.js';
import { checkAutoDisconnect as checkMusicAutoDisconnect } from './commands/music.js';
import { Poru } from 'poru';
import { Spotify } from 'poru-spotify';

// Validate required environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error('Error: DISCORD_TOKEN is not set in environment variables');
    process.exit(1);
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
    ] 
});

// Command prefix
const PREFIX = '$';

// Initialize Poru client with Lavalink (will be initialized after client is ready)
let poruClient = null;

// Store interval references for cleanup
let updateInterval = null;
let voiceRewardInterval = null;

// Counter channel functionality
async function updateMemberCount(guild) {
    const channelId = process.env.COUNTER_CHANNEL_ID;
    
    if (!channelId) {
        console.warn('COUNTER_CHANNEL_ID not set in environment variables');
        return;
    }

    try {
        const channel = await guild.channels.fetch(channelId);
        
        if (!channel) {
            console.error(`Channel with ID ${channelId} not found in guild ${guild.name}`);
            return;
        }

        // Get member count
        const memberCount = guild.memberCount;
        const channelName = `👥 Members: ${memberCount}`;

        // Only update if the name has changed to avoid rate limits
        if (channel.name !== channelName) {
            await channel.setName(channelName);
            console.log(`[${guild.name}] Updated member count: ${memberCount}`);
        }
    } catch (error) {
        if (error.code === 50001) {
            console.error(`[${guild.name}] Missing access to channel ${channelId}`);
        } else if (error.code === 10003) {
            console.error(`[${guild.name}] Channel ${channelId} not found`);
        } else {
            console.error(`[${guild.name}] Error updating member count:`, error.message);
        }
    }
}

// Handle prefix commands
client.on('messageCreate', async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;
    
    // Ignore messages that don't start with prefix
    if (!message.content.startsWith(PREFIX)) return;
    
    // Ignore DMs (commands only work in servers)
    if (!message.guild) {
        await message.reply('❌ Les commandes ne peuvent être utilisées que dans les serveurs !');
        return;
    }
    
    // Parse command and arguments
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    
    if (!commandName) return;
    
    try {
        switch (commandName) {
            case 'balance':
            case 'bal':
                await economyCommands.balanceCommand(message);
                break;
            case 'daily':
                await economyCommands.dailyCommand(message);
                break;
            case 'work':
                await economyCommands.workCommand(message);
                break;
            case 'give':
            case 'pay':
                await economyCommands.giveCommand(message, args);
                break;
            case 'leaderboard':
            case 'lb':
            case 'top':
                await economyCommands.leaderboardCommand(message);
                break;
            case 'setbalance':
            case 'setbal':
                await economyCommands.setBalanceCommand(message, args);
                break;
            case 'addmoney':
            case 'add':
                await economyCommands.addMoneyCommand(message, args);
                break;
            case 'hardreset':
            case 'reset':
                await economyCommands.hardResetCommand(message, args);
                break;
            case 'profile':
            case 'p':
                await economyCommands.profileCommand(message);
                break;
            case 'help':
            case 'h':
                await economyCommands.helpCommand(message);
                break;
            case 'faaahhh':
            case 'fah':
                await soundboardCommands.faaahhhCommand(message);
                break;
            case 'roll':
                await gamesCommands.rollCommand(message);
                break;
            case 'pfc':
                await gamesCommands.pfcCommand(message, args);
                break;
            case 'fish':
            case 'peche':
            case 'pêche':
                await fishingCommands.fishCommand(message);
                break;
            case 'sellfish':
            case 'sf':
            case 'vendre':
                await fishingCommands.sellFishCommand(message, args);
                break;
            case 'inventory':
            case 'inv':
            case 'inventaire':
                await fishingCommands.inventoryCommand(message);
                break;
            case 'achievements':
            case 'achievement':
            case 'ach':
                await fishingCommands.achievementsCommand(message);
                break;
            case 'casino':
            case 'slot':
            case 'slots':
                await casinoCommands.casinoCommand(message, args);
                break;
            case 'allin':
            case 'all-in':
                await casinoCommands.allinCommand(message);
                break;
            case 'say':
                await gamesCommands.sayCommand(message, args);
                break;
            case 'play':
            case 'p':
                await musicCommands.playCommand(message, args);
                break;
            case 'pause':
                await musicCommands.pauseCommand(message);
                break;
            case 'resume':
            case 'unpause':
                await musicCommands.resumeCommand(message);
                break;
            case 'skip':
            case 'next':
                await musicCommands.skipCommand(message, args);
                break;
            case 'stop':
                await musicCommands.stopCommand(message);
                break;
            case 'queue':
            case 'q':
                await musicCommands.queueCommand(message);
                break;
            case 'nowplaying':
            case 'np':
            case 'current':
                await musicCommands.nowplayingCommand(message);
                break;
            case 'leave':
            case 'disconnect':
            case 'dc':
                await musicCommands.leaveCommand(message);
                break;
            case 'lyrics':
            case 'ly':
                await musicCommands.lyricsCommand(message);
                break;
            default:
                // Silently ignore unknown commands to avoid spam
                break;
        }
    } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        await message.reply('❌ Une erreur est survenue lors de l\'exécution de cette commande !').catch(() => {
            // Ignore if message was deleted or bot can't reply
        });
    }
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
    // Only handle button interactions
    if (!interaction.isButton()) return;
    
    // Handle PFC (Pierre-Feuille-Ciseaux) buttons
    if (interaction.customId.startsWith('pfc_')) {
        const choice = interaction.customId.split('_')[1]; // Extract choice from customId
        
        try {
            // Check if buttons are already disabled (game already played)
            if (interaction.message.components[0]?.components[0]?.disabled) {
                await interaction.reply({ content: '❌ Ce jeu a déjà été joué !', ephemeral: true });
                return;
            }
            
            // Handle the interaction
            const result = gamesCommands.handlePFCInteraction(interaction, choice);
            
            // Check if result is an error message (ephemeral reply)
            if (result.ephemeral) {
                await interaction.reply(result);
            } else {
                // Update the message with new embed/components
                await interaction.update(result);
            }
        } catch (error) {
            console.error('Error handling PFC interaction:', error);
            
            // Handle different error cases
            if (error.code === 10062) {
                // Unknown interaction - might be expired
                await interaction.reply({ 
                    content: '❌ Cette interaction a expiré. Veuillez relancer une nouvelle partie.', 
                    ephemeral: true 
                }).catch(() => {});
            } else if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: '❌ Une erreur est survenue lors du traitement de votre choix.', 
                    ephemeral: true 
                }).catch(() => {});
            } else {
                await interaction.reply({ 
                    content: '❌ Une erreur est survenue lors du traitement de votre choix.', 
                    ephemeral: true 
                }).catch(() => {});
            }
        }
    }
});

// Store active profile pagination messages
const profilePaginationMessages = new Map(); // messageId -> { userId, guildId, currentPage }
global.profilePaginationMessages = profilePaginationMessages;

// Handle message reactions for profile pagination
client.on('messageReactionAdd', async (reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;
    
    // Check if this is a profile pagination message
    const paginationData = profilePaginationMessages.get(reaction.message.id);
    if (!paginationData) return;
    
    // Only allow the original user to navigate
    if (user.id !== paginationData.userId) {
        await reaction.users.remove(user.id).catch(() => {});
        return;
    }
    
    try {
        // Fetch the full message if partial
        const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
        
        // Get the emoji
        const emoji = reaction.emoji.name;
        
        // Handle navigation
        if (emoji === '🐟' && paginationData.currentPage === 1) {
            // Switch to fish inventory page
            const fishEmbed = await economyCommands.createFishInventoryEmbed(
                message,
                paginationData.userId,
                paginationData.guildId
            );
            
            await message.edit({ embeds: [fishEmbed] });
            paginationData.currentPage = 2;
            profilePaginationMessages.set(message.id, paginationData);
            
            // Remove reaction
            await reaction.users.remove(user.id).catch(() => {});
        } else if (emoji === '🏆' && paginationData.currentPage === 1) {
            // Switch to achievements page
            const achievementsEmbed = await economyCommands.createAchievementsEmbed(
                message,
                paginationData.userId,
                paginationData.guildId
            );
            
            await message.edit({ embeds: [achievementsEmbed] });
            paginationData.currentPage = 3;
            profilePaginationMessages.set(message.id, paginationData);
            
            // Remove reaction
            await reaction.users.remove(user.id).catch(() => {});
        } else if (emoji === '🏆' && paginationData.currentPage === 2) {
            // Switch from fish page to achievements page
            const achievementsEmbed = await economyCommands.createAchievementsEmbed(
                message,
                paginationData.userId,
                paginationData.guildId
            );
            
            await message.edit({ embeds: [achievementsEmbed] });
            paginationData.currentPage = 3;
            profilePaginationMessages.set(message.id, paginationData);
            
            // Remove reaction
            await reaction.users.remove(user.id).catch(() => {});
        } else if (emoji === '🐟' && paginationData.currentPage === 3) {
            // Switch from achievements page to fish page
            const fishEmbed = await economyCommands.createFishInventoryEmbed(
                message,
                paginationData.userId,
                paginationData.guildId
            );
            
            await message.edit({ embeds: [fishEmbed] });
            paginationData.currentPage = 2;
            profilePaginationMessages.set(message.id, paginationData);
            
            // Remove reaction
            await reaction.users.remove(user.id).catch(() => {});
        } else if (emoji === '◀️' && paginationData.currentPage === 2) {
            // Switch back from fish page to profile page
            const profileEmbed = await economyCommands.rebuildProfileEmbed(
                message,
                paginationData.userId,
                paginationData.guildId
            );
            
            await message.edit({ embeds: [profileEmbed] });
            paginationData.currentPage = 1;
            profilePaginationMessages.set(message.id, paginationData);
            
            // Remove reaction
            await reaction.users.remove(user.id).catch(() => {});
        } else if (emoji === '◀️' && paginationData.currentPage === 3) {
            // Switch back to profile page
            const profileEmbed = await economyCommands.rebuildProfileEmbed(
                message,
                paginationData.userId,
                paginationData.guildId
            );
            
            await message.edit({ embeds: [profileEmbed] });
            paginationData.currentPage = 1;
            profilePaginationMessages.set(message.id, paginationData);
            
            // Remove reaction
            await reaction.users.remove(user.id).catch(() => {});
        }
    } catch (error) {
        console.error('Error handling profile pagination:', error);
        await reaction.users.remove(user.id).catch(() => {});
    }
});

// Clean up pagination data when message is deleted
client.on('messageDelete', (message) => {
    profilePaginationMessages.delete(message.id);
});

// Handle voice state updates (join/leave voice channels)
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Ignore bot users
    if (newState.member?.user.bot || oldState.member?.user.bot) return;
    
    const userId = newState.member?.user.id || oldState.member?.user.id;
    const guildId = newState.guild.id;
    
    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
        await setVoiceJoinTime(userId, guildId);
        console.log(`[Voice] ${newState.member.user.username} joined voice channel`);
    }
    
    // User left a voice channel (or was disconnected)
    if (oldState.channelId && !newState.channelId) {
        await clearVoiceJoinTime(userId, guildId);
        console.log(`[Voice] ${newState.member.user.username} left voice channel`);
        
        // Check if music bot should auto-disconnect (channel might be empty now)
        if (oldState.channel) {
            await checkMusicAutoDisconnect(newState.guild);
        }
    }
    
    // User switched voice channels (still in voice, just different channel)
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // Keep tracking - they're still in voice, just moved channels
        console.log(`[Voice] ${newState.member.user.username} switched voice channels`);
        
        // Check both old and new channels for auto-disconnect
        if (oldState.channel) {
            await checkMusicAutoDisconnect(newState.guild);
        }
        if (newState.channel) {
            await checkMusicAutoDisconnect(newState.guild);
        }
    }
    
    // User joined a voice channel - check if bot should stay connected
    if (!oldState.channelId && newState.channelId) {
        await checkMusicAutoDisconnect(newState.guild);
    }
});

// Check and reward users in voice channels
async function checkVoiceRewards() {
    const timestamp = new Date().toLocaleString('fr-FR', { 
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    console.log(`\n[${timestamp}] [Voice Rewards] Vérification des récompenses vocales...`);
    
    let totalRewarded = 0;
    let totalChecked = 0;
    
    for (const guild of client.guilds.cache.values()) {
        // Get all members currently in voice channels
        const voiceMembers = guild.members.cache.filter(member => 
            member.voice.channel && !member.user.bot
        );
        
        totalChecked += voiceMembers.size;
        
        for (const member of voiceMembers.values()) {
            try {
                const reward = await checkVoiceReward(member.user.id, guild.id);
                if (reward && reward.rewarded) {
                    totalRewarded++;
                    const channelName = member.voice.channel?.name || 'Unknown';
                    
                    // Log reward details
                    console.log(
                        `[${timestamp}] [Voice Rewards] ✅ RÉCOMPENSE ATTRIBUÉE\n` +
                        `  👤 Utilisateur: ${member.user.username} (${member.user.id})\n` +
                        `  🏰 Serveur: ${guild.name} (${guild.id})\n` +
                        `  🔊 Canal: ${channelName}\n` +
                        `  💰 Montant: ${reward.amount} coins\n` +
                        `  💵 Nouveau solde: ${reward.balance.toLocaleString()} coins`
                    );
                    
                    // Try to send DM notification (optional, might fail if DMs disabled)
                    try {
                        const embed = new EmbedBuilder()
                            .setTitle('🎤 Récompense Vocale !')
                            .setDescription(`Vous êtes resté dans un canal vocal pendant 30+ minutes !\nVous avez gagné **${reward.amount}** coins !\nVotre nouveau solde est de **${reward.balance.toLocaleString()}** coins.`)
                            .setColor(0x00ff00)
                            .setTimestamp();
                        
                        await member.send({ embeds: [embed] }).catch(() => {
                            // Ignore if DMs are disabled
                        });
                    } catch (error) {
                        // Ignore DM errors
                    }
                }
                // Note: Users not rewarded are not logged to keep console clean
            } catch (error) {
                console.error(`[${timestamp}] [Voice Rewards] ❌ Erreur pour ${member.user.username}:`, error.message);
            }
        }
    }
    
    // Summary log
    console.log(
        `[${timestamp}] [Voice Rewards] 📊 Résumé:\n` +
        `  ✅ Récompenses attribuées: ${totalRewarded}\n` +
        `  👥 Utilisateurs vérifiés: ${totalChecked}\n` +
        `  ────────────────────────────────────────`
    );
}


// Poru configuration - will be initialized after client is ready
const lavalinkHost = process.env.LAVALINK_HOST || 'lavalink';
const lavalinkPort = parseInt(process.env.LAVALINK_PORT || '2333');
const lavalinkPassword = process.env.LAVALINK_PASSWORD || 'youshallnotpass';

console.log(`🔌 Configuration Poru pour Lavalink: host=${lavalinkHost}, port=${lavalinkPort}`);

// Update counter when bot is ready (using clientReady to avoid deprecation warning)
client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Bot is using prefix: ${PREFIX}`);
    
    // Initialize Poru client (following AeroX example exactly)
    console.log('🔌 Initialisation de Poru avec Lavalink...');
    
    // Create nodes array (following AeroX pattern)
    const nodes = [{
        name: 'lavalink',
        host: lavalinkHost,
        port: lavalinkPort,
        password: lavalinkPassword,
        secure: false,
    }];
    
    // Get Spotify credentials from environment
    const spotifyClientId = process.env.SPOTIFY_CLIENT_ID || '';
    const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    
    // Initialize plugins array (Spotify if credentials are available)
    const plugins = [];
    if (spotifyClientId && spotifyClientSecret) {
        plugins.push(new Spotify({
            clientID: spotifyClientId,
            clientSecret: spotifyClientSecret,
        }));
        console.log('✅ Plugin Spotify activé');
    }
    
    // Initialize Poru with proper configuration (following AeroX example)
    poruClient = new Poru(client, nodes, {
        library: 'discord.js',
        defaultPlatform: process.env.MUSIC_DEFAULT_PLATFORM || 'youtube',
        resumeKey: 'DiscordBot',
        resumeTimeout: 60,
        reconnectTimeout: 10000,
        reconnectTries: 5,
        plugins: plugins,
    });
    
    // Set up Poru event handlers (following AeroX pattern)
    poruClient.on('nodeConnect', (node) => {
        console.log(`✅ Lavalink node "${node.name}" connected`);
    });
    
    poruClient.on('nodeReconnect', (node) => {
        console.log(`🔄 Lavalink node reconnecting: ${node.name}`);
    });
    
    poruClient.on('nodeDisconnect', (node) => {
        console.warn(`⚠️ Lavalink node disconnected: ${node.name}`);
    });
    
    poruClient.on('nodeError', (node, error) => {
        console.error(`❌ Lavalink node error (${node.name}): ${error.message}`);
    });
    
    // Wait a bit for Lavalink to be ready before initializing Poru
    console.log('⏳ Attente que Lavalink soit prêt...');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Wait 8 seconds for Lavalink to fully start
    
    // Initialize Poru (must be called after client is ready, following AeroX pattern)
    poruClient.init(client.user.id);
    console.log('✅ Poru client initialisé');
    
    // Set up player event handlers
    poruClient.on('trackStart', (player, track) => {
        const formatDuration = (ms) => {
            if (!ms || ms === 0) return '0:00';
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        };

        const embed = new EmbedBuilder()
            .setTitle('🎵 En cours de lecture')
            .setDescription(`**[${track.info.title}](${track.info.uri})**`)
            .addFields(
                { name: '⏱️ Durée', value: track.info.isStream ? 'Live' : formatDuration(track.info.length), inline: true },
                { name: '👤 Artiste', value: track.info.author || 'Inconnu', inline: true }
            )
            .setThumbnail(track.info.image || null)
            .setColor(0x00ff00);

        const channel = client.channels.cache.get(player.textChannel);
        if (channel) channel.send({ embeds: [embed] }).catch(() => {});
    });
    
    poruClient.on('playerEmpty', (player) => {
        const embed = new EmbedBuilder()
            .setDescription('🔇 Le canal vocal est vide. Je me déconnecte...')
            .setColor(0xff9900);

        const channel = client.channels.cache.get(player.textChannel);
        if (channel) channel.send({ embeds: [embed] }).catch(() => {});
        
        player.destroy();
    });
    
    poruClient.on('queueEnd', (player) => {
        const embed = new EmbedBuilder()
            .setDescription('✅ La file d\'attente est terminée !')
            .setColor(0x00ff00);

        const channel = client.channels.cache.get(player.textChannel);
        if (channel) channel.send({ embeds: [embed] }).catch(() => {});
        
        player.destroy();
    });
    
    // Set player instance in music commands (now that client is ready)
    musicCommands.setPlayer(poruClient);
    
    // Set Genius API key if available
    const geniusApiKey = process.env.GENIUS_API_KEY || '';
    if (geniusApiKey) {
        musicCommands.setGeniusApiKey(geniusApiKey);
        console.log('✅ API Genius configurée');
    }
    
    // Wait for node connection (following AeroX pattern)
    console.log('⏳ Attente de la connexion au node Lavalink...');
    
    // Wait a bit for connection
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check node connection status
    const poruNodes = poruClient.nodes;
    if (poruNodes && poruNodes.size > 0) {
        const connectedNodes = Array.from(poruNodes.values()).filter(node => node.isConnected);
        if (connectedNodes.length > 0) {
            console.log(`✅ ${connectedNodes.length} node(s) Lavalink connecté(s) !`);
        } else {
            const allNodes = Array.from(poruNodes.values());
            console.warn(`⚠️ ${allNodes.length} node(s) configuré(s) mais aucun connecté. États:`, 
                allNodes.map(n => `${n.name}: ${n.isConnected ? 'connected' : 'disconnected'}`).join(', '));
        }
    } else {
        console.warn('⚠️ Aucun node Lavalink configuré.');
    }
    
    // Migrate fish from inventory to collection (one-time migration on startup)
    // Wait a bit for PostgreSQL to be fully ready
    try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for PostgreSQL
        console.log('🔄 Migration des poissons de l\'inventaire vers la collection...');
        const migrationResult = await migrateInventoryToCollection();
        if (migrationResult.usersAffected > 0) {
            console.log(`✅ Migration terminée: ${migrationResult.migrated} poissons migrés pour ${migrationResult.usersAffected} utilisateurs`);
        } else {
            console.log('✅ Aucune migration nécessaire (tous les poissons sont déjà dans les collections)');
        }
    } catch (error) {
        console.error('❌ Erreur lors de la migration des poissons:', error.message);
        // Don't stop the bot if migration fails, just log the error
        // This is expected if PostgreSQL is not available or tables don't exist yet
    }
    
    // Update counter for all guilds the bot is in
    for (const guild of client.guilds.cache.values()) {
        await updateMemberCount(guild);
    }
    
    // Update counter every 5 minutes (300000 ms)
    // This ensures the count stays accurate without requiring privileged intents
    updateInterval = setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
            await updateMemberCount(guild);
        }
    }, 300000); // 5 minutes
    
    // Check voice channel rewards every 5 minutes
    voiceRewardInterval = setInterval(async () => {
        await checkVoiceRewards();
    }, 300000); // 5 minutes
    
    console.log('Compteur de membres initialisé. Mises à jour toutes les 5 minutes.');
    console.log('Récompenses vocales actives (50 coins toutes les 30 minutes).');
    console.log('Système d\'économie prêt ! Utilisez $help pour les commandes.');
});

// Poru with library: 'discord.js' handles voice events automatically
// No manual raw event handler needed when using library: 'discord.js'

// Handle client errors
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

// Handle warnings
client.on('warn', (warning) => {
    console.warn('Discord client warning:', warning);
});

// Handle disconnects
client.on('disconnect', () => {
    console.warn('Bot disconnected from Discord');
});

// Graceful shutdown handling
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    
    // Clear the update intervals
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    if (voiceRewardInterval) {
        clearInterval(voiceRewardInterval);
    }
    
    // Close database connection
    closeDatabase();
    
    // Destroy the client
    client.destroy();
    
    console.log('Bot shutdown complete.');
    process.exit(0);
};

// Handle process termination signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    const errorMessage = reason?.message || String(reason);
    const statusCode = reason?.statusCode || reason?.code;
    
    // Handle rate limit errors gracefully
    if (statusCode === 429 || 
        errorMessage.includes('429') || 
        errorMessage.includes('rate limit') || 
        errorMessage.includes('Too Many Requests') ||
        errorMessage.includes('Status code: 429')) {
        console.warn('[Rate Limit] YouTube rate limit hit. This is expected and will be handled automatically.');
        return; // Don't log as error, it's handled by retry logic
    }
    
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('Failed to login to Discord:', error.message);
    process.exit(1);
});