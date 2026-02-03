// Only load dotenv in development (Docker sets env vars directly)
if (process.env.NODE_ENV !== 'production') {
    const dotenv = await import('dotenv');
    dotenv.config();
}

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
import * as pokemonCommands from './commands/pokemon.js';
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
        return; // Silently skip if no channel ID configured
    }

    try {
        // Check if this guild has the counter channel (avoid fetching from wrong guild)
        const channel = guild.channels.cache.get(channelId);
        
        if (!channel) {
            // Channel not in this guild's cache - skip silently
            // This is normal when bot is in multiple guilds but channel is only in one
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
            // Channel not found - skip silently
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
                await economyCommands.helpCommand(message, args);
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
            // === MARIO PARTY CASINO ===
            case 'casino':
                await casinoCommands.casinoCommand(message, args);
                break;
            case 'slot':
            case 'slots':
                await casinoCommands.slotsCommand(message, args);
                break;
            case 'wheel':
            case 'roue':
                await casinoCommands.wheelCommand(message, args);
                break;
            case 'coinflip':
            case 'flip':
            case 'cf':
                await casinoCommands.coinflipCommand(message, args);
                break;
            case 'duel':
            case 'defi':
                await casinoCommands.duelCommand(message, args);
                break;
            case 'bowser':
                await casinoCommands.bowserCommand(message, args);
                break;
            case 'allin':
            case 'all-in':
                await casinoCommands.allinCommand(message);
                break;
            // Pokemon commands
            case 'catch':
            case 'attraper':
                await pokemonCommands.catchCommand(message);
                break;
            case 'testlegendary':
            case 'testleg':
                await pokemonCommands.testLegendaryCommand(message);
                break;
            case 'pokedex':
            case 'dex':
                await pokemonCommands.pokedexCommand(message, args);
                break;
            case 'pokemon':
            case 'poke':
            case 'pk':
                await pokemonCommands.pokemonInfoCommand(message, args);
                break;
            case 'pc':
            case 'box':
            case 'boite':
                await pokemonCommands.pcCommand(message, args);
                break;
            case 'evolve':
            case 'evoluer':
                await pokemonCommands.evolveCommand(message, args);
                break;
            case 'trade':
            case 'echange':
            case 'échanger':
                await pokemonCommands.tradeCommand(message, args);
                break;
            case 'testtrade':
            case 'demotrade':
                await pokemonCommands.testTradeCommand(message);
                break;
            case 'megashop':
            case 'megaboutique':
            case 'pierres':
                await pokemonCommands.megashopCommand(message, args);
                break;
            case 'buildpokemoncache':
                // Admin command to build French names cache
                if (message.member?.permissions?.has('Administrator')) {
                    await pokemonCommands.buildFrenchNamesCache(message);
                } else {
                    await message.reply('❌ Cette commande est réservée aux administrateurs.');
                }
                break;
            case 'buildcategoriescache':
                // Admin command to build categories cache (legendary, mythical, etc.)
                if (message.member?.permissions?.has('Administrator')) {
                    await pokemonCommands.buildCategoriesCache(message);
                } else {
                    await message.reply('❌ Cette commande est réservée aux administrateurs.');
                }
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
            case 'shuffle':
            case 'mix':
                await musicCommands.shuffleCommand(message);
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
            case 'tts':
            case 'speak':
            case 'say-voice':
                await musicCommands.ttsCommand(message, args);
                break;
            case 'lyrics':
            case 'ly':
                await musicCommands.lyricsCommand(message);
                break;
            case 'search':
            case 'sr':
                await musicCommands.searchCommand(message, args);
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
    
    // Handle Pokemon shiny button
    if (interaction.customId.startsWith('pokemon_')) {
        try {
            await pokemonCommands.handlePokemonInteraction(interaction);
        } catch (error) {
            console.error('Error handling Pokemon interaction:', error);
            await interaction.reply({ 
                content: '❌ Une erreur est survenue.', 
                ephemeral: true 
            }).catch(() => {});
        }
    }
    
    // Handle Pokedex navigation buttons
    if (interaction.customId.startsWith('dex_')) {
        try {
            await pokemonCommands.handlePokedexNavigation(interaction);
        } catch (error) {
            console.error('Error handling Pokedex navigation:', error);
            await interaction.reply({ 
                content: '❌ Une erreur est survenue.', 
                ephemeral: true 
            }).catch(() => {});
        }
    }
    
    // Handle Pokemon QTE catch button
    if (interaction.customId.startsWith('qte_')) {
        try {
            await pokemonCommands.handleQTEInteraction(interaction);
        } catch (error) {
            console.error('Error handling QTE interaction:', error);
            await interaction.reply({ 
                content: '❌ Une erreur est survenue.', 
                ephemeral: true 
            }).catch(() => {});
        }
    }
    
    // Handle Pokemon trade buttons
    if (interaction.customId.startsWith('trade_')) {
        try {
            await pokemonCommands.handleTradeConfirmation(interaction);
        } catch (error) {
            console.error('Error handling trade interaction:', error);
            await interaction.reply({ 
                content: '❌ Une erreur est survenue.', 
                ephemeral: true 
            }).catch(() => {});
        }
    }
    
    // Handle Profile buttons (Collection, Achievements, Back)
    if (interaction.customId.startsWith('profile_')) {
        try {
            await economyCommands.handleProfileButton(interaction);
        } catch (error) {
            console.error('Error handling Profile button interaction:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ Une erreur est survenue.', 
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
        defaultPlatform: process.env.MUSIC_DEFAULT_PLATFORM || 'scsearch',
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
    
    // Initialize Poru immediately (Lavalink should be ready thanks to Docker healthcheck)
    console.log('⏳ Initialisation de Poru...');
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
        console.log('📭 playerEmpty event triggered - voice channel is empty');
        const embed = new EmbedBuilder()
            .setDescription('🔇 Le canal vocal est vide. Je me déconnecte...')
            .setColor(0xff9900);

        const channel = client.channels.cache.get(player.textChannel);
        if (channel) channel.send({ embeds: [embed] }).catch(() => {});
        
        player.destroy();
    });
    
    poruClient.on('queueEnd', (player) => {
        console.log('🏁 queueEnd event triggered - queue is empty, current track:', player.currentTrack?.info?.title || 'none');
        const embed = new EmbedBuilder()
            .setDescription('✅ La file d\'attente est terminée !')
            .setColor(0x00ff00);

        const channel = client.channels.cache.get(player.textChannel);
        if (channel) channel.send({ embeds: [embed] }).catch(() => {});
        
        player.destroy();
    });
    
    poruClient.on('trackEnd', (player, track, reason) => {
        const position = player.position || 0;
        const duration = track?.info?.length || 0;
        const percentPlayed = duration > 0 ? Math.round((position / duration) * 100) : 0;
        console.log(`⏹️ trackEnd event: "${track?.info?.title || 'unknown'}" - Reason: ${reason?.reason || reason || 'unknown'}`);
        console.log(`   Position: ${Math.round(position/1000)}s / ${Math.round(duration/1000)}s (${percentPlayed}% played)`);
        console.log(`   Queue length: ${player.queue?.length || 0}`);
        
        // If track ended early (less than 90% played) and reason is not user action, it might be a stream issue
        if (percentPlayed < 90 && reason?.reason !== 'stopped' && reason?.reason !== 'replaced') {
            console.warn(`⚠️ Track may have ended prematurely! Only ${percentPlayed}% was played.`);
        }
    });
    
    poruClient.on('trackException', (player, track, error) => {
        console.error('Track exception:', error);
        
        const errorMessage = error?.message || error?.exception?.message || 'Erreur inconnue';
        let userMessage = '❌ Erreur lors de la lecture de la piste.';
        
        if (errorMessage.includes('login') || errorMessage.includes('requires login')) {
            userMessage = '❌ Cette vidéo nécessite une connexion YouTube et ne peut pas être lue. Veuillez essayer une autre vidéo.';
        } else if (errorMessage.includes('unavailable') || errorMessage.includes('private')) {
            userMessage = '❌ Cette vidéo n\'est pas disponible (privée ou supprimée).';
        } else if (errorMessage.includes('age-restricted')) {
            userMessage = '❌ Cette vidéo est restreinte par âge et ne peut pas être lue.';
        }
        
        const embed = new EmbedBuilder()
            .setDescription(`${userMessage}\n\n**Piste:** ${track?.info?.title || 'Inconnue'}`)
            .setColor(0xff0000);

        const channel = client.channels.cache.get(player.textChannel);
        if (channel) channel.send({ embeds: [embed] }).catch(() => {});
        
        // Skip to next track if available
        if (player.queue.length > 0) {
            player.skip();
        } else {
            player.destroy();
        }
    });
    
    // Track stuck retry tracking
    const stuckRetries = new Map();
    
    poruClient.on('trackError', async (player, track, error) => {
        console.error('Track error:', error);
        
        const isStuckEvent = error?.type === 'TrackStuckEvent';
        const trackId = track?.encoded || track?.info?.identifier || 'unknown';
        
        // For stuck events, try to resume playback instead of destroying
        if (isStuckEvent) {
            const retryCount = stuckRetries.get(trackId) || 0;
            
            if (retryCount < 2) {
                stuckRetries.set(trackId, retryCount + 1);
                console.log(`🔄 Track stuck, attempting resume (retry ${retryCount + 1}/2)...`);
                
                try {
                    // Get current position and seek back slightly to retry
                    const currentPos = track?.info?.position || error?.position || 0;
                    const seekPos = Math.max(0, currentPos - 5000); // Go back 5 seconds
                    
                    await player.seekTo(seekPos);
                    if (player.isPaused) {
                        await player.pause(false);
                    }
                    
                    const channel = client.channels.cache.get(player.textChannel);
                    if (channel && retryCount === 0) {
                        const embed = new EmbedBuilder()
                            .setDescription(`⚠️ Problème de streaming détecté, reprise en cours...\n**Piste:** ${track?.info?.title || 'Inconnue'}`)
                            .setColor(0xffa500);
                        channel.send({ embeds: [embed] }).catch(() => {});
                    }
                    return;
                } catch (e) {
                    console.error('Resume failed:', e);
                }
            }
            
            // Clear retry count after max retries
            stuckRetries.delete(trackId);
        }
        
        const errorMessage = error?.message || error?.exception?.message || 'Erreur inconnue';
        let userMessage = isStuckEvent 
            ? '⚠️ La piste a rencontré un problème de streaming et a été ignorée.'
            : '❌ Erreur lors de la lecture de la piste.';
        
        if (errorMessage.includes('login') || errorMessage.includes('requires login')) {
            userMessage = '❌ Cette vidéo nécessite une connexion YouTube et ne peut pas être lue. Veuillez essayer une autre vidéo.';
        } else if (errorMessage.includes('unavailable') || errorMessage.includes('private')) {
            userMessage = '❌ Cette vidéo n\'est pas disponible (privée ou supprimée).';
        } else if (errorMessage.includes('age-restricted')) {
            userMessage = '❌ Cette vidéo est restreinte par âge et ne peut pas être lue.';
        }
        
        const embed = new EmbedBuilder()
            .setDescription(`${userMessage}\n\n**Piste:** ${track?.info?.title || 'Inconnue'}`)
            .setColor(isStuckEvent ? 0xffa500 : 0xff0000);

        const channel = client.channels.cache.get(player.textChannel);
        if (channel) channel.send({ embeds: [embed] }).catch(() => {});
        
        // Skip to next track if available
        if (player.queue.length > 0) {
            player.skip();
        } else {
            player.destroy();
        }
    });
    
    // Set player instance in music commands (now that client is ready)
    musicCommands.setPlayer(poruClient);
    
    // Set Genius Access Token if available
    const geniusAccessToken = process.env.GENIUS_ACCESS_TOKEN || '';
    if (geniusAccessToken) {
        musicCommands.setGeniusApiKey(geniusAccessToken);
        console.log('✅ API Genius configurée');
    }
    
    // Wait for node connection with active polling (much faster than fixed waits)
    console.log('⏳ Attente de la connexion au node Lavalink...');
    
    const maxWaitTime = 15000; // 15 seconds max
    const pollInterval = 250; // Check every 250ms
    let elapsed = 0;
    let connected = false;
    
    while (elapsed < maxWaitTime && !connected) {
        const poruNodes = poruClient.nodes;
        if (poruNodes && poruNodes.size > 0) {
            const connectedNodes = Array.from(poruNodes.values()).filter(node => node.isConnected);
            if (connectedNodes.length > 0) {
                connected = true;
                console.log(`✅ ${connectedNodes.length} node(s) Lavalink connecté(s) ! (${elapsed}ms)`);
                break;
            }
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        elapsed += pollInterval;
    }
    
    if (!connected) {
        const poruNodes = poruClient.nodes;
        if (poruNodes && poruNodes.size > 0) {
            const allNodes = Array.from(poruNodes.values());
            console.warn(`⚠️ ${allNodes.length} node(s) configuré(s) mais aucun connecté après ${maxWaitTime}ms. États:`, 
                allNodes.map(n => `${n.name}: ${n.isConnected ? 'connected' : 'disconnected'}`).join(', '));
        } else {
            console.warn('⚠️ Aucun node Lavalink configuré.');
        }
    }
    
    // Migrate fish from inventory to collection (one-time migration on startup)
    // PostgreSQL is already ready thanks to Docker healthcheck
    try {
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