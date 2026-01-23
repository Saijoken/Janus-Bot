import { EmbedBuilder } from 'discord.js';

// Get the Kazagumo player instance
let player = null;

export function setPlayer(playerInstance) {
    player = playerInstance;
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
    if (!player) {
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
        
        // Search for tracks using Kazagumo
        const result = await player.search(query, {
            requester: message.author,
            engine: query.startsWith('http') ? undefined : 'youtube', // Use YouTube search if not a URL
        });
        
        if (!result || result.tracks.length === 0) {
            await message.reply('❌ Aucun résultat trouvé pour votre recherche !');
            return;
        }

        // Get or create player for this guild
        let guildPlayer = player.players.get(message.guild.id);
        
        if (!guildPlayer) {
            guildPlayer = await player.createPlayer({
                guildId: message.guild.id,
                voiceId: member.voice.channel.id,
                textId: message.channel.id,
                deaf: true,
            });
        } else {
            // Update text channel if changed
            guildPlayer.setTextChannel(message.channel.id);
        }

        // Handle playlist or single track
        if (result.type === 'PLAYLIST') {
            for (const track of result.tracks) {
                guildPlayer.queue.add(track);
            }
            
            const embed = new EmbedBuilder()
                .setDescription(`✅ **${result.playlistName}** (${result.tracks.length} chansons) ajoutée à la file d'attente !`)
                .setColor(0x00ff00)
                .setThumbnail(result.tracks[0]?.thumbnail || null);

            await message.reply({ embeds: [embed] });
        } else {
            const track = result.tracks[0];
            guildPlayer.queue.add(track);
            
            const embed = new EmbedBuilder()
                .setDescription(`✅ **${track.title}** ajouté à la file d'attente !`)
                .setColor(0x00ff00)
                .setThumbnail(track.thumbnail || null);

            await message.reply({ embeds: [embed] });
        }

        // Start playing if not already playing
        if (!guildPlayer.playing && !guildPlayer.paused) {
            await guildPlayer.play();
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
    if (!player) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const guildPlayer = player.players.get(message.guild.id);
    if (!guildPlayer || !guildPlayer.playing) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    if (guildPlayer.paused) {
        await message.reply('⏸️ La musique est déjà en pause !');
        return;
    }

    await guildPlayer.pause(true);
    const embed = new EmbedBuilder()
        .setDescription('⏸️ Musique mise en pause')
        .setColor(0xff9900);

    await message.reply({ embeds: [embed] });
}

/**
 * Resume command
 */
export async function resumeCommand(message) {
    if (!player) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const guildPlayer = player.players.get(message.guild.id);
    if (!guildPlayer) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    if (!guildPlayer.paused) {
        await message.reply('▶️ La musique n\'est pas en pause !');
        return;
    }

    await guildPlayer.pause(false);
    const embed = new EmbedBuilder()
        .setDescription('▶️ Musique reprise')
        .setColor(0x00ff00);

    await message.reply({ embeds: [embed] });
}

/**
 * Skip command
 */
export async function skipCommand(message, args) {
    if (!player) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const guildPlayer = player.players.get(message.guild.id);
    if (!guildPlayer || !guildPlayer.playing) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    const skipCount = args.length > 0 ? parseInt(args[0]) : 1;
    
    if (isNaN(skipCount) || skipCount < 1) {
        await message.reply('❌ Veuillez fournir un nombre valide de chansons à passer !');
        return;
    }

    const currentTrack = guildPlayer.queue.current;
    
    if (skipCount === 1) {
        await guildPlayer.skip();
        const embed = new EmbedBuilder()
            .setDescription(`⏭️ Passage de **${currentTrack.title}**...`)
            .setColor(0xff9900);
        await message.reply({ embeds: [embed] });
    } else {
        // Skip multiple songs
        for (let i = 0; i < skipCount - 1 && guildPlayer.queue.size > 0; i++) {
            guildPlayer.queue.remove(0);
        }
        await guildPlayer.skip();
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
    if (!player) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const guildPlayer = player.players.get(message.guild.id);
    if (!guildPlayer) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    guildPlayer.destroy();
    const embed = new EmbedBuilder()
        .setDescription('🛑 Musique arrêtée et file d\'attente vidée')
        .setColor(0xff0000);

    await message.reply({ embeds: [embed] });
}

/**
 * Queue command - Show current queue
 */
export async function queueCommand(message) {
    if (!player) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const guildPlayer = player.players.get(message.guild.id);
    if (!guildPlayer || guildPlayer.queue.size === 0) {
        await message.reply('❌ La file d\'attente est vide !');
        return;
    }

    const queueList = guildPlayer.queue.map((track, index) => {
        return `${index + 1}. **${track.title}**`;
    }).slice(0, 10).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('📋 File d\'attente')
        .setDescription(queueList)
        .setColor(0x0099ff)
        .setFooter({ 
            text: guildPlayer.queue.size > 10 
                ? `Et ${guildPlayer.queue.size - 10} autre(s) chanson(s)...` 
                : `${guildPlayer.queue.size} chanson(s) au total` 
        });

    if (guildPlayer.queue.current) {
        embed.addFields({
            name: '🎵 En cours',
            value: `**${guildPlayer.queue.current.title}**`,
            inline: false
        });
    }

    await message.reply({ embeds: [embed] });
}

/**
 * Now playing command
 */
export async function nowplayingCommand(message) {
    if (!player) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const guildPlayer = player.players.get(message.guild.id);
    if (!guildPlayer || !guildPlayer.queue.current) {
        await message.reply('❌ Aucune musique n\'est en cours de lecture !');
        return;
    }

    const track = guildPlayer.queue.current;
    const status = guildPlayer.paused ? '⏸️ En pause' : '▶️ En cours de lecture';

    const embed = new EmbedBuilder()
        .setTitle('🎵 En cours de lecture')
        .setDescription(`**[${track.title}](${track.uri})**`)
        .addFields(
            { name: '⏱️ Durée', value: track.isStream ? 'Live' : formatDuration(track.length), inline: true },
            { name: '👤 Artiste', value: track.author || 'Inconnu', inline: true },
            { name: '📊 Statut', value: status, inline: true }
        )
        .setThumbnail(track.thumbnail || null)
        .setColor(guildPlayer.paused ? 0xff9900 : 0x00ff00)
        .setFooter({ text: `${guildPlayer.queue.size} chanson(s) dans la file` });

    await message.reply({ embeds: [embed] });
}

/**
 * Leave command - Disconnect from voice channel
 */
export async function leaveCommand(message) {
    if (!player) {
        await message.reply('❌ Le bot de musique n\'est pas initialisé !');
        return;
    }

    const guildPlayer = player.players.get(message.guild.id);
    if (!guildPlayer) {
        await message.reply('❌ Je ne suis pas connecté à un canal vocal !');
        return;
    }

    guildPlayer.destroy();
    const embed = new EmbedBuilder()
        .setDescription('👋 Déconnexion du canal vocal')
        .setColor(0xff9900);

    await message.reply({ embeds: [embed] });
}

/**
 * Auto-disconnect check (for compatibility with index.js)
 */
export async function checkAutoDisconnect(guild) {
    // Kazagumo handles auto-disconnect automatically via playerEmpty event
    // This function is kept for compatibility
}
