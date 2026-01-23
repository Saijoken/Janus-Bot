import { EmbedBuilder } from 'discord.js';
import { getLyrics, searchSong } from 'genius-lyrics-api';

// Get the Poru client instance
let poruClient = null;
let geniusApiKey = null;

export function setGeniusApiKey(apiKey) {
    geniusApiKey = apiKey;
}

export function setPlayer(clientInstance) {
    poruClient = clientInstance;
}

/**
 * Format duration helper
 */
function formatDuration(ms) {
    if (!ms || ms === 0) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Play command - Add song to queue and play
 */
export async function playCommand(message, args) {
    if (!poruClient) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const member = message.member;
    if (!member || !member.voice.channel) {
        await message.reply('❌ Vous devez être dans un canal vocal pour utiliser cette commande !');
        return;
    }

    if (args.length === 0) {
        await message.reply('❌ Veuillez fournir une URL YouTube ou un terme de recherche !\nExemple: `$play https://www.youtube.com/watch?v=...` ou `$play nom de la chanson`');
        return;
    }

    const query = args.join(' ');

    try {
        await message.channel.sendTyping();

        console.log('🔍 Recherche de:', query);
        
        // Detect source based on query (Spotify URL or YouTube URL)
        let source = 'youtube';
        if (query.includes('open.spotify.com') || query.includes('spotify.com')) {
            source = 'spotify';
        } else if (query.includes('youtube.com') || query.includes('youtu.be')) {
            source = 'youtube';
        } else {
            // Default to YouTube for search queries
            source = 'youtube';
        }
        
        // Resolve tracks using Poru
        const result = await poruClient.resolve({
            query: query,
            source: source,
        });
        
        if (!result || (!result.tracks && !result.loadType)) {
            await message.reply('❌ Aucun résultat trouvé pour votre recherche !');
            return;
        }

        // Get or create player for this guild
        let player = poruClient.players.get(message.guild.id);
        
        if (!player) {
            player = await poruClient.createConnection({
                guildId: message.guild.id,
                voiceChannel: member.voice.channel.id,
                textChannel: message.channel.id,
                deaf: true,
            });
        } else {
            // Update text channel if changed
            player.textChannel = message.channel.id;
        }

        // Handle different load types
        if (result.loadType === 'PLAYLIST_LOADED') {
            // Playlist
            for (const track of result.tracks) {
                player.queue.add(track);
            }
            
            const embed = new EmbedBuilder()
                .setDescription(`✅ **${result.playlistInfo.name}** (${result.tracks.length} chansons) ajoutée à la file d'attente !`)
                .setColor(0x00ff00)
                .setThumbnail(result.tracks[0]?.info?.image || null);

            await message.reply({ embeds: [embed] });
        } else if (result.loadType === 'SEARCH_RESULT' || result.loadType === 'TRACK_LOADED') {
            // Single track
            const track = result.tracks[0];
            player.queue.add(track);
            
            const embed = new EmbedBuilder()
                .setDescription(`✅ **${track.info.title}** ajouté à la file d'attente !`)
                .setColor(0x00ff00)
                .setThumbnail(track.info.image || null);

            await message.reply({ embeds: [embed] });
        } else {
            await message.reply('❌ Aucun résultat trouvé pour votre recherche !');
            return;
        }

        // Start playing if not already playing
        if (!player.isPlaying && !player.isPaused) {
            await player.play();
        }
    } catch (error) {
        console.error('Error in play command:', error);
        let errorMessage = error.message || 'Erreur inconnue';
        
        if (errorMessage.includes('No results') || errorMessage.includes('No matches')) {
            errorMessage = '❌ Aucun résultat trouvé pour votre recherche !';
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
            errorMessage = '⏳ YouTube limite les requêtes. Veuillez réessayer dans quelques instants.';
        } else if (errorMessage.includes('Voice channel')) {
            errorMessage = '❌ Vous devez être dans un canal vocal !';
        }
        
        await message.reply(`❌ Erreur: ${errorMessage}`);
    }
}

/**
 * Pause command
 */
export async function pauseCommand(message) {
    if (!poruClient) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const player = poruClient.players.get(message.guild.id);
    if (!player || !player.isPlaying) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    if (player.isPaused) {
        await message.reply('⏸️ La musique est déjà en pause !');
        return;
    }

    await player.pause(true);
    const embed = new EmbedBuilder()
        .setDescription('⏸️ Musique mise en pause')
        .setColor(0xff9900);

    await message.reply({ embeds: [embed] });
}

/**
 * Resume command
 */
export async function resumeCommand(message) {
    if (!poruClient) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const player = poruClient.players.get(message.guild.id);
    if (!player) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    if (!player.isPaused) {
        await message.reply('▶️ La musique n\'est pas en pause !');
        return;
    }

    await player.pause(false);
    const embed = new EmbedBuilder()
        .setDescription('▶️ Musique reprise')
        .setColor(0x00ff00);

    await message.reply({ embeds: [embed] });
}

/**
 * Skip command
 */
export async function skipCommand(message, args) {
    if (!poruClient) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const player = poruClient.players.get(message.guild.id);
    if (!player || !player.isPlaying) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    const skipCount = args.length > 0 ? parseInt(args[0]) : 1;
    
    if (isNaN(skipCount) || skipCount < 1) {
        await message.reply('❌ Veuillez fournir un nombre valide de chansons à passer !');
        return;
    }

    const currentTrack = player.currentTrack;
    
    if (skipCount === 1) {
        await player.skip();
        const embed = new EmbedBuilder()
            .setDescription(`⏭️ Passage de **${currentTrack.info.title}**...`)
            .setColor(0xff9900);
        await message.reply({ embeds: [embed] });
    } else {
        // Skip multiple songs
        for (let i = 0; i < skipCount - 1 && player.queue.length > 0; i++) {
            player.queue.shift();
        }
        await player.skip();
        const embed = new EmbedBuilder()
            .setDescription(`⏭️ Passage de ${skipCount} chanson(s)...`)
            .setColor(0xff9900);
        await message.reply({ embeds: [embed] });
    }
}

/**
 * Stop command
 */
export async function stopCommand(message) {
    if (!poruClient) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const player = poruClient.players.get(message.guild.id);
    if (!player) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    player.destroy();
    const embed = new EmbedBuilder()
        .setDescription('🛑 Musique arrêtée et file d\'attente vidée')
        .setColor(0xff0000);

    await message.reply({ embeds: [embed] });
}

/**
 * Queue command - Show current queue
 */
export async function queueCommand(message) {
    if (!poruClient) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const player = poruClient.players.get(message.guild.id);
    if (!player || player.queue.length === 0) {
        await message.reply('❌ La file d\'attente est vide !');
        return;
    }

    const queueList = player.queue.map((track, index) => {
        return `${index + 1}. **${track.info.title}**`;
    }).slice(0, 10).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('📋 File d\'attente')
        .setDescription(queueList)
        .setColor(0x0099ff)
        .setFooter({ 
            text: player.queue.length > 10 
                ? `Et ${player.queue.length - 10} autre(s) chanson(s)...` 
                : `${player.queue.length} chanson(s) au total` 
        });

    if (player.currentTrack) {
        embed.addFields({
            name: '🎵 En cours',
            value: `**${player.currentTrack.info.title}**`,
            inline: false
        });
    }

    await message.reply({ embeds: [embed] });
}

/**
 * Now playing command
 */
export async function nowplayingCommand(message) {
    if (!poruClient) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const player = poruClient.players.get(message.guild.id);
    if (!player || !player.currentTrack) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    const track = player.currentTrack;
    const status = player.isPaused ? '⏸️ En pause' : '▶️ En cours de lecture';

    const embed = new EmbedBuilder()
        .setTitle('🎵 En cours de lecture')
        .setDescription(`**[${track.info.title}](${track.info.uri})**`)
        .addFields(
            { name: '⏱️ Durée', value: track.info.isStream ? 'Live' : formatDuration(track.info.length), inline: true },
            { name: '👤 Artiste', value: track.info.author || 'Inconnu', inline: true },
            { name: '📊 Statut', value: status, inline: true }
        )
        .setThumbnail(track.info.image || null)
        .setColor(player.isPaused ? 0xff9900 : 0x00ff00)
        .setFooter({ text: `${player.queue.length} chanson(s) dans la file` });

    await message.reply({ embeds: [embed] });
}

/**
 * Leave command - Disconnect from voice channel
 */
export async function leaveCommand(message) {
    if (!poruClient) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const player = poruClient.players.get(message.guild.id);
    if (!player) {
        await message.reply('❌ Je ne suis pas connecté à un canal vocal !');
        return;
    }

    player.destroy();
    const embed = new EmbedBuilder()
        .setDescription('👋 Déconnexion du canal vocal')
        .setColor(0xff9900);

    await message.reply({ embeds: [embed] });
}

/**
 * Lyrics command - Get lyrics from Genius
 */
export async function lyricsCommand(message) {
    if (!geniusApiKey) {
        await message.reply('❌ L\'API Genius n\'est pas configurée !');
        return;
    }

    const player = poruClient?.players.get(message.guild.id);
    if (!player || !player.currentTrack) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    const track = player.currentTrack;
    const title = track.info.title;
    const author = track.info.author || 'Unknown';

    try {
        await message.channel.sendTyping();

        // Search for the song on Genius
        const searchResults = await searchSong({
            apiKey: geniusApiKey,
            title: title,
            artist: author,
            optimizeQuery: true,
        });

        if (!searchResults || searchResults.length === 0) {
            await message.reply(`❌ Aucune parole trouvée pour **${title}** par **${author}**`);
            return;
        }

        // Get lyrics from the first result
        const lyrics = await getLyrics({
            apiKey: geniusApiKey,
            title: searchResults[0].title,
            artist: searchResults[0].artist.name,
            optimizeQuery: true,
        });

        if (!lyrics) {
            await message.reply(`❌ Impossible de récupérer les paroles pour **${title}**`);
            return;
        }

        // Split lyrics if too long (Discord limit is 4096 characters)
        const maxLength = 4096 - 100; // Leave some margin
        if (lyrics.length > maxLength) {
            const chunks = [];
            for (let i = 0; i < lyrics.length; i += maxLength) {
                chunks.push(lyrics.substring(i, i + maxLength));
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎵 Paroles: ${searchResults[0].title}`)
                .setDescription(chunks[0])
                .setColor(0x1db954)
                .setFooter({ text: `Par ${searchResults[0].artist.name} • Page 1/${chunks.length}` })
                .setThumbnail(searchResults[0].albumArt || track.info.image || null);

            await message.reply({ embeds: [embed] });

            // Send remaining chunks
            for (let i = 1; i < chunks.length; i++) {
                const chunkEmbed = new EmbedBuilder()
                    .setDescription(chunks[i])
                    .setColor(0x1db954)
                    .setFooter({ text: `Page ${i + 1}/${chunks.length}` });

                await message.channel.send({ embeds: [chunkEmbed] });
            }
        } else {
            const embed = new EmbedBuilder()
                .setTitle(`🎵 Paroles: ${searchResults[0].title}`)
                .setDescription(lyrics)
                .setColor(0x1db954)
                .setFooter({ text: `Par ${searchResults[0].artist.name}` })
                .setThumbnail(searchResults[0].albumArt || track.info.image || null);

            await message.reply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error in lyrics command:', error);
        await message.reply(`❌ Erreur lors de la récupération des paroles: ${error.message}`);
    }
}

/**
 * Auto-disconnect check (for compatibility with index.js)
 */
export async function checkAutoDisconnect(guild) {
    // Poru handles auto-disconnect automatically via playerEmpty event
    // This function is kept for compatibility
}
