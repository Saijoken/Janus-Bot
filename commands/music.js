import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { getLyrics, searchSong } from 'genius-lyrics-api';
// Node.js 18+ has native fetch

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
 * Check if a SoundCloud track is a preview (30 seconds only)
 * Previews have /preview/ in the identifier URL
 */
function isSoundCloudPreview(track) {
    if (!track || track.info?.sourceName !== 'soundcloud') return false;
    const identifier = track.info?.identifier || '';
    return identifier.includes('/preview/') || identifier.includes('/preview%2F');
}

/**
 * Play command - Add song to queue and play
 * Based on AeroX-CV2-Music-Bot structure
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
        await message.reply('❌ Veuillez fournir une URL YouTube/Spotify ou un terme de recherche !\nExemple: `$play https://www.youtube.com/watch?v=...` ou `$play nom de la chanson`');
        return;
    }

    const query = args.join(' ');

    // Check Spotify configuration if query contains Spotify
    if (query.toLowerCase().includes('spotify') && (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET)) {
        await message.reply('❌ Spotify n\'est pas configuré par le propriétaire du bot.');
        return;
    }

    try {
        await message.channel.sendTyping();

        console.log('🔍 Recherche de:', query);
        
        // Resolve tracks using Poru
        let res;
        try {
            // Check if query already has a search prefix
            const searchPrefixMap = {
                'ytsearch:': 'ytsearch',
                'ytmsearch:': 'ytmsearch',
                'scsearch:': 'scsearch',
                'spsearch:': 'spsearch',
                'amsearch:': 'amsearch',
                'dzsearch:': 'dzsearch',
                'dzisrc:': 'dzisrc',
                'ymsearch:': 'ymsearch',
            };
            
            // Check for TTS prefixes (these should be passed as-is to Lavalink)
            const ttsPrefixes = ['speak:', 'tts:', 'ftts:'];
            const isTTS = ttsPrefixes.some(prefix => query.toLowerCase().startsWith(prefix));
            
            // Check for search prefixes
            let detectedPrefix = null;
            for (const [prefix, source] of Object.entries(searchPrefixMap)) {
                if (query.toLowerCase().startsWith(prefix)) {
                    detectedPrefix = { prefix, source };
                    break;
                }
            }
            
            let resolveOptions = { requester: message.author };
            
            if (isTTS) {
                // TTS queries - pass directly without any source
                resolveOptions.query = query;
                console.log('🔍 TTS query:', query);
            } else if (detectedPrefix) {
                // Query has a search prefix - extract and use it properly
                const searchTerm = query.substring(detectedPrefix.prefix.length);
                resolveOptions.query = searchTerm;
                resolveOptions.source = detectedPrefix.source;
                console.log('🔍 Prefixed search:', detectedPrefix.source, 'query:', searchTerm);
            } else if (query.includes('open.spotify.com') || query.includes('spotify.com')) {
                resolveOptions.query = query;
                resolveOptions.source = 'spotify';
                console.log('🔍 Spotify URL:', query);
            } else if (query.includes('youtube.com') || query.includes('youtu.be')) {
                resolveOptions.query = query;
                resolveOptions.source = 'youtube';
                console.log('🔍 YouTube URL:', query);
            } else if (query.includes('soundcloud.com')) {
                resolveOptions.query = query;
                resolveOptions.source = 'soundcloud';
                console.log('🔍 SoundCloud URL:', query);
            } else if (query.startsWith('http://') || query.startsWith('https://')) {
                // Generic URL - let Lavalink handle it (no source)
                resolveOptions.query = query;
                console.log('🔍 Direct URL:', query);
            } else {
                // Plain text search - use SoundCloud search (default)
                resolveOptions.query = query;
                resolveOptions.source = 'scsearch';
                console.log('🔍 SoundCloud search:', query);
            }
            
            res = await poruClient.resolve(resolveOptions);
            // Debug logging
            console.log('📊 Poru resolve result:', {
                loadType: res?.loadType,
                tracksCount: res?.tracks?.length || 0,
                playlistInfo: res?.playlistInfo,
                exception: res?.exception,
            });
        } catch (e) {
            console.error('Poru resolve error:', e);
            await message.reply(`❌ Échec de la recherche: ${e?.message || 'Erreur inconnue'}`);
            return;
        }

        // Handle Spotify playlist specifically
        const isSpotifyPlaylist = /^https?:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]+/i.test(query.trim());
        if (isSpotifyPlaylist) {
            if (!res || res.loadType !== 'PLAYLIST_LOADED' || !Array.isArray(res.tracks) || res.tracks.length === 0) {
                await message.reply('❌ Aucun résultat trouvé ou playlist invalide.');
                return;
            }

            let player = poruClient.players.get(message.guild.id);
            if (!player) {
                player = await poruClient.createConnection({
                    guildId: message.guild.id,
                    voiceChannel: member.voice.channel.id,
                    textChannel: message.channel.id,
                    deaf: true,
                });
            } else {
                player.textChannel = message.channel.id;
            }

            if (player.autoplayEnabled === undefined) player.autoplayEnabled = false;

            for (const track of res.tracks) {
                track.info.requester = message.author;
                player.queue.add(track);
            }

            if (!player.isPlaying && player.isConnected) {
                await player.play();
            }

            const embed = new EmbedBuilder()
                .setDescription(`## 🎵 Playlist ${res.playlistInfo?.name || 'Spotify Playlist'}\nAjout de **${res.tracks.length}** pistes à la file d'attente !`)
                .setColor(0x1db954);

            await message.reply({ embeds: [embed] });
            return;
        }

        // Handle search results - filter out shorts (tracks < 70000ms)
        if (res.loadType === 'search') {
            const filteredTracks = res.tracks.filter((track) => !track.info.isStream && track.info.length > 70000);
            if (!filteredTracks.length) {
                await message.reply('❌ Aucun résultat trouvé (shorts filtrés).');
                return;
            }
            res.tracks = filteredTracks;
        }

        // Handle error load type
        if (res.loadType === 'error') {
            await message.reply(`❌ Échec du chargement: ${res.exception?.message || 'Erreur inconnue'}`);
            return;
        }

        // Handle empty load type
        if (res.loadType === 'empty') {
            await message.reply('❌ Aucun résultat trouvé.');
            return;
        }

        // Check for SoundCloud preview and prepare warning
        let isPreviewTrack = false;
        if (res.tracks && res.tracks.length > 0) {
            isPreviewTrack = isSoundCloudPreview(res.tracks[0]);
            if (isPreviewTrack) {
                console.log('⚠️ SoundCloud preview detected for:', res.tracks[0].info?.title);
            }
        }

        // Get or create player for this guild
        let player = poruClient.players.get(message.guild.id);
        console.log('🎮 Player exists:', !!player);
        if (!player) {
            console.log('🔌 Creating new connection to voice channel:', member.voice.channel.id);
            player = await poruClient.createConnection({
                guildId: message.guild.id,
                voiceChannel: member.voice.channel.id,
                textChannel: message.channel.id,
                deaf: true,
            });
            console.log('✅ Player created, isConnected:', player?.isConnected);
        } else {
            player.textChannel = message.channel.id;
        }

        if (player.autoplayEnabled === undefined) player.autoplayEnabled = false;

        // Handle playlist load type
        if (res.loadType === 'playlist' || res.loadType === 'PLAYLIST_LOADED') {
            for (const track of res.tracks) {
                track.info.requester = message.author;
                player.queue.add(track);
            }

            if (!player.isPlaying && player.isConnected) {
                await player.play();
            }

            const embed = new EmbedBuilder()
                .setDescription(`## 🎵 Playlist ${res.playlistInfo?.name || 'Playlist'}\nAjout de **${res.tracks.length}** pistes à la file d'attente !`)
                .setColor(0x00ff00);

            await message.reply({ embeds: [embed] });
            return;
        }

        // Handle single track (SEARCH_RESULT, TRACK_LOADED, track, search)
        if (res.tracks && res.tracks.length > 0) {
            const track = res.tracks[0];
            console.log('🎵 Track found:', track.info?.title);
            
            track.info.requester = message.author;
            player.queue.add(track);
            console.log('📝 Track added to queue, queue length:', player.queue.length);

            console.log('🔊 Player state - isPlaying:', player.isPlaying, 'isConnected:', player.isConnected, 'isPaused:', player.isPaused);
            if (!player.isPlaying && player.isConnected) {
                console.log('▶️ Starting playback...');
                await player.play();
                console.log('✅ Playback started');
            }

            // Build embed with preview warning if applicable
            const embed = new EmbedBuilder()
                .setThumbnail(track.info.artworkUrl || null);
            
            if (isPreviewTrack) {
                embed.setTitle('⚠️ Aperçu SoundCloud (30s)')
                    .setDescription(`Ajout de **[${track.info.title}](${track.info.uri})** à la file d'attente !\n\n` +
                        `⚠️ *Ce titre n'est disponible qu'en aperçu de 30 secondes.*\n` +
                        `💡 Pour le titre complet: \`$play ytsearch:${track.info.title} ${track.info.author}\``)
                    .setColor(0xff9900);
            } else {
                embed.setDescription(`✅ Ajout de **[${track.info.title}](${track.info.uri})** à la file d'attente !`)
                    .setColor(0x00ff00);
            }

            await message.reply({ embeds: [embed] });
            return;
        }

        // Fallback
        await message.reply('❌ Aucun résultat trouvé pour votre recherche !');
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
 * Search command - Show multiple results and let user choose
 */
export async function searchCommand(message, args) {
    if (!poruClient) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    if (!args || args.length === 0) {
        await message.reply('❌ Veuillez spécifier une recherche ! Usage: `$search <terme>`');
        return;
    }

    const query = args.join(' ');

    const member = message.member;
    if (!member.voice.channel) {
        await message.reply('❌ Vous devez être dans un canal vocal !');
        return;
    }

    try {
        // Determine search source
        const searchPrefixMap = {
            'ytsearch:': 'ytsearch',
            'ytmsearch:': 'ytmsearch',
            'scsearch:': 'scsearch',
            'spsearch:': 'spsearch',
            'amsearch:': 'amsearch',
            'dzsearch:': 'dzsearch',
            'ymsearch:': 'ymsearch',
        };

        let resolveOptions = { requester: message.author };
        let detectedPrefix = null;
        let sourceName = 'YouTube';

        for (const [prefix, source] of Object.entries(searchPrefixMap)) {
            if (query.toLowerCase().startsWith(prefix)) {
                detectedPrefix = { prefix, source };
                break;
            }
        }

        if (detectedPrefix) {
            const searchTerm = query.substring(detectedPrefix.prefix.length);
            resolveOptions.query = searchTerm;
            resolveOptions.source = detectedPrefix.source;
            
            // Set friendly source name
            const sourceNames = {
                'ytsearch': 'YouTube',
                'ytmsearch': 'YouTube Music',
                'scsearch': 'SoundCloud',
                'spsearch': 'Spotify',
                'amsearch': 'Apple Music',
                'dzsearch': 'Deezer',
                'ymsearch': 'Yandex Music',
            };
            sourceName = sourceNames[detectedPrefix.source] || detectedPrefix.source;
        } else {
            resolveOptions.query = query;
            resolveOptions.source = 'scsearch';
            sourceName = 'SoundCloud';
        }

        const res = await poruClient.resolve(resolveOptions);

        if (!res || res.loadType === 'empty' || res.loadType === 'error' || !res.tracks?.length) {
            await message.reply('❌ Aucun résultat trouvé.');
            return;
        }

        // Filter out shorts
        let tracks = res.tracks.filter(t => !t.info.isStream && t.info.length > 30000);
        
        if (!tracks.length) {
            await message.reply('❌ Aucun résultat valide trouvé.');
            return;
        }

        // Smart sorting based on word matching
        // Split query into words (filter out short words like "the", "a", etc.)
        const queryWords = query.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 2 && !['the', 'and', 'for', 'feat', 'with'].includes(w));

        // Calculate match score for a track
        const getMatchScore = (track) => {
            const title = track.info.title.toLowerCase();
            const author = track.info.author.toLowerCase();
            const combined = `${title} ${author}`;
            let score = 0;

            // Count matching words (each word = 10 points)
            for (const word of queryWords) {
                if (combined.includes(word)) score += 10;
            }

            // Bonus: Author name contains query words (important for "artist - song" searches)
            for (const word of queryWords) {
                if (author.includes(word)) score += 15; // Extra bonus for author match
            }

            // Bonus: Title contains query words
            for (const word of queryWords) {
                if (title.includes(word)) score += 5;
            }

            // Bonus: Official/verified
            if (author.includes('official') || title.includes('official')) score += 20;

            // Bonus: Exact author match (e.g., "toby fox" in author)
            const authorWords = queryWords.slice(0, 2).join(' '); // First 2 words often = artist name
            if (author.includes(authorWords) && authorWords.length > 3) score += 30;

            return score;
        };

        // Sort by score (highest first), keep original order for ties
        tracks.sort((a, b) => {
            const scoreA = getMatchScore(a);
            const scoreB = getMatchScore(b);
            return scoreB - scoreA;
        });

        // Limit to 10 results after sorting
        tracks = tracks.slice(0, 10);
        
        if (!tracks.length) {
            await message.reply('❌ Aucun résultat trouvé.');
            return;
        }

        // Number emojis for reactions
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const cancelEmoji = '❌';

        // Build result list with preview warnings
        const resultList = tracks.map((track, index) => {
            const duration = formatDuration(track.info.length);
            const title = track.info.title.length > 40 ? track.info.title.substring(0, 37) + '...' : track.info.title;
            const author = track.info.author.length > 18 ? track.info.author.substring(0, 15) + '...' : track.info.author;
            const isPreview = isSoundCloudPreview(track);
            const previewTag = isPreview ? ' ⚠️30s' : '';
            return `${numberEmojis[index]} [${title}](${track.info.uri})${previewTag}\n┗ 👤 ${author} • ⏱️ ${duration}`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`🔍 Résultats de recherche - ${sourceName}`)
            .setDescription(resultList)
            .setColor(0x3498db)
            .setFooter({ text: `Réagissez avec un numéro pour sélectionner • ${cancelEmoji} pour annuler • Expire dans 60s` });

        const reply = await message.reply({ embeds: [embed] });

        // Add reactions
        const reactEmojis = numberEmojis.slice(0, tracks.length);
        reactEmojis.push(cancelEmoji);
        
        for (const emoji of reactEmojis) {
            await reply.react(emoji).catch(() => {});
        }

        // Wait for reaction
        try {
            const collected = await reply.awaitReactions({
                filter: (reaction, user) => {
                    return user.id === message.author.id && 
                           (numberEmojis.includes(reaction.emoji.name) || reaction.emoji.name === cancelEmoji);
                },
                max: 1,
                time: 60000,
                errors: ['time']
            });

            const reaction = collected.first();
            
            // Remove all reactions
            await reply.reactions.removeAll().catch(() => {});

            if (reaction.emoji.name === cancelEmoji) {
                const cancelEmbedMsg = new EmbedBuilder()
                    .setDescription('❌ Recherche annulée.')
                    .setColor(0xff0000);
                await reply.edit({ embeds: [cancelEmbedMsg] });
                return;
            }

            const selectedIndex = numberEmojis.indexOf(reaction.emoji.name);
            if (selectedIndex === -1 || selectedIndex >= tracks.length) {
                await reply.edit({ embeds: [new EmbedBuilder().setDescription('❌ Sélection invalide.').setColor(0xff0000)] });
                return;
            }

            const selectedTrack = tracks[selectedIndex];

            // Get or create player
            let player = poruClient.players.get(message.guild.id);
            if (!player) {
                player = await poruClient.createConnection({
                    guildId: message.guild.id,
                    voiceChannel: member.voice.channel.id,
                    textChannel: message.channel.id,
                    deaf: true,
                });
            } else {
                player.textChannel = message.channel.id;
            }

            if (player.autoplayEnabled === undefined) player.autoplayEnabled = false;

            selectedTrack.info.requester = message.author;
            player.queue.add(selectedTrack);

            if (!player.isPlaying && player.isConnected) {
                await player.play();
            }

            const confirmEmbed = new EmbedBuilder()
                .setDescription(`## 🎵 Ajouté à la file d'attente\n[${selectedTrack.info.title}](${selectedTrack.info.uri})\n👤 ${selectedTrack.info.author} • ⏱️ ${formatDuration(selectedTrack.info.length)}`)
                .setThumbnail(selectedTrack.info.artworkUrl || null)
                .setColor(0x00ff00)
                .setFooter({ text: `Demandé par ${message.author.username}`, iconURL: message.author.displayAvatarURL() });

            await reply.edit({ embeds: [confirmEmbed] });

        } catch (e) {
            // Timeout or error
            await reply.reactions.removeAll().catch(() => {});
            const timeoutEmbed = new EmbedBuilder()
                .setDescription('⏱️ Temps écoulé - recherche expirée.')
                .setColor(0xff9900);
            await reply.edit({ embeds: [timeoutEmbed] }).catch(() => {});
        }

    } catch (error) {
        console.error('Error in search command:', error);
        await message.reply(`❌ Erreur: ${error.message || 'Erreur inconnue'}`);
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
 * Lyrics command - Get lyrics from Lavalink or Genius
 */
export async function lyricsCommand(message) {
    const player = poruClient?.players.get(message.guild.id);
    if (!player || !player.currentTrack) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    const track = player.currentTrack;
    const title = track.info.title;
    const author = track.info.author || 'Unknown';
    const encodedTrack = track.encoded;

    try {
        await message.channel.sendTyping();

        let lyrics = null;
        let source = 'Lavalink';
        let lyricsTitle = title;
        let lyricsArtist = author;

        // Try Lavalink lyrics plugins first
        const lavalinkHost = process.env.LAVALINK_HOST || 'lavalink';
        const lavalinkPort = process.env.LAVALINK_PORT || '2333';
        const lavalinkPassword = process.env.LAVALINK_PASSWORD || 'youshallnotpass';

        try {
            // Try java-lyrics-plugin endpoint
            const lyricsResponse = await fetch(
                `http://${lavalinkHost}:${lavalinkPort}/v4/lyrics/${encodeURIComponent(encodedTrack)}`,
                {
                    headers: {
                        'Authorization': lavalinkPassword
                    }
                }
            );

            if (lyricsResponse.ok) {
                const lyricsData = await lyricsResponse.json();
                if (lyricsData && lyricsData.lines && lyricsData.lines.length > 0) {
                    // Format synced lyrics
                    lyrics = lyricsData.lines.map(line => line.line).join('\n');
                    source = lyricsData.source || 'Lavalink';
                } else if (lyricsData && lyricsData.text) {
                    lyrics = lyricsData.text;
                    source = lyricsData.source || 'Lavalink';
                }
            }
        } catch (lavalinkError) {
            console.log('Lavalink lyrics not available, trying Genius...');
        }

        // Fallback to Genius if Lavalink didn't work
        if (!lyrics && geniusApiKey) {
            try {
                // Search for the song on Genius API
                const searchQuery = `${title} ${author}`.replace(/[^\w\s]/g, '').trim();
                const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(searchQuery)}`;
                
                const searchResponse = await fetch(searchUrl, {
                    headers: {
                        'Authorization': `Bearer ${geniusApiKey}`
                    }
                });
                
                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    const hits = searchData?.response?.hits;
                    
                    if (hits && hits.length > 0) {
                        const song = hits[0].result;
                        lyricsTitle = song.title || title;
                        lyricsArtist = song.primary_artist?.name || author;
                        const lyricsUrl = song.url;
                        
                        // Fetch the lyrics page with browser-like headers
                        const pageResponse = await fetch(lyricsUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.5',
                                'Accept-Encoding': 'gzip, deflate, br',
                                'Connection': 'keep-alive',
                                'Upgrade-Insecure-Requests': '1',
                                'Sec-Fetch-Dest': 'document',
                                'Sec-Fetch-Mode': 'navigate',
                                'Sec-Fetch-Site': 'none',
                                'Sec-Fetch-User': '?1',
                                'Cache-Control': 'max-age=0'
                            }
                        });
                        
                        if (pageResponse.ok) {
                            const html = await pageResponse.text();
                            
                            // Extract lyrics from HTML using regex patterns
                            // Genius uses data-lyrics-container divs
                            const lyricsMatches = html.match(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g);
                            
                            if (lyricsMatches && lyricsMatches.length > 0) {
                                lyrics = lyricsMatches
                                    .map(match => {
                                        return match
                                            .replace(/<br\s*\/?>/gi, '\n')
                                            .replace(/<[^>]+>/g, '')
                                            .replace(/&amp;/g, '&')
                                            .replace(/&lt;/g, '<')
                                            .replace(/&gt;/g, '>')
                                            .replace(/&quot;/g, '"')
                                            .replace(/&#x27;/g, "'")
                                            .replace(/&#39;/g, "'")
                                            .trim();
                                    })
                                    .join('\n\n');
                                source = 'Genius';
                            }
                        }
                    }
                }
            } catch (geniusError) {
                console.log('Genius lyrics error:', geniusError.message);
            }
        }

        if (!lyrics) {
            await message.reply(`❌ Aucune parole trouvée pour **${title}** par **${author}**`);
            return;
        }

        // Split lyrics if too long (Discord limit is 4096 characters)
        const maxLength = 4096 - 100;
        if (lyrics.length > maxLength) {
            const chunks = [];
            for (let i = 0; i < lyrics.length; i += maxLength) {
                chunks.push(lyrics.substring(i, i + maxLength));
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎵 Paroles: ${lyricsTitle}`)
                .setDescription(chunks[0])
                .setColor(0x1db954)
                .setFooter({ text: `Par ${lyricsArtist} • Source: ${source} • Page 1/${chunks.length}` })
                .setThumbnail(track.info.artworkUrl || null);

            await message.reply({ embeds: [embed] });

            for (let i = 1; i < chunks.length; i++) {
                const chunkEmbed = new EmbedBuilder()
                    .setDescription(chunks[i])
                    .setColor(0x1db954)
                    .setFooter({ text: `Page ${i + 1}/${chunks.length}` });

                await message.channel.send({ embeds: [chunkEmbed] });
            }
        } else {
            const embed = new EmbedBuilder()
                .setTitle(`🎵 Paroles: ${lyricsTitle}`)
                .setDescription(lyrics)
                .setColor(0x1db954)
                .setFooter({ text: `Par ${lyricsArtist} • Source: ${source}` })
                .setThumbnail(track.info.artworkUrl || null);

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
