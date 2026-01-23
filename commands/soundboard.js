import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    getVoiceConnection
} from '@discordjs/voice';
import { EmbedBuilder } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import ffmpegStatic from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set FFmpeg path for @discordjs/voice
if (ffmpegStatic) {
    process.env.FFMPEG_PATH = ffmpegStatic;
}

/**
 * Faaahhh command - Play soundboard in voice channel
 */
export async function faaahhhCommand(message) {
    // Check if user is in a voice channel
    const member = message.member;
    if (!member || !member.voice.channel) {
        await message.reply('❌ Vous devez être dans un canal vocal pour utiliser cette commande !');
        return;
    }

    const voiceChannel = member.voice.channel;

    // Check if bot has permission to join and speak
    if (!voiceChannel.joinable) {
        await message.reply('❌ Je n\'ai pas la permission de rejoindre ce canal vocal !');
        return;
    }

    if (!voiceChannel.speakable) {
        await message.reply('❌ Je n\'ai pas la permission de parler dans ce canal vocal !');
        return;
    }

    try {
        // Get existing connection or create new one
        let connection = getVoiceConnection(message.guild.id);
        
        if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
        }

        // Wait for connection to be ready
        connection.once(VoiceConnectionStatus.Ready, async () => {
            try {
                // Create audio player
                const player = createAudioPlayer();

                // Path to sound file - you can place your sound file in a 'sounds' folder
                // Supported formats: MP3, OGG, WAV, etc.
                const soundPath = join(__dirname, '../sounds/faaahhh.mp3');
                
                // Check if file exists
                if (!existsSync(soundPath)) {
                    throw new Error('Fichier audio introuvable. Veuillez ajouter sounds/faaahhh.mp3 à votre projet.');
                }
                
                // Create audio resource from file using ffmpeg
                // FFmpeg will automatically handle format conversion and encoding
                const resource = createAudioResource(soundPath, {
                    inputType: 'file',
                    inlineVolume: false,
                });

                player.play(resource);
                connection.subscribe(player);

                // Send confirmation
                const embed = new EmbedBuilder()
                    .setTitle('🔊 Lecture du Son !')
                    .setDescription(`Lecture de **faaahhh** dans ${voiceChannel.name} !`)
                    .setColor(0x00ff00)
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                // Clean up when finished
                player.once(AudioPlayerStatus.Idle, () => {
                    setTimeout(() => {
                        if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                            connection.destroy();
                        }
                    }, 1000);
                });

                player.on('error', (error) => {
                    console.error('Audio player error:', error);
                    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                        connection.destroy();
                    }
                });

            } catch (error) {
                console.error('Error playing audio:', error);
                await message.reply(`❌ Échec de la lecture du son ! ${error.message}`);
                if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                    connection.destroy();
                }
            }
        });

        connection.once(VoiceConnectionStatus.Disconnected, () => {
            setTimeout(() => {
                if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                    connection.destroy();
                }
            }, 1000);
        });

        connection.on('error', (error) => {
            console.error('Voice connection error:', error);
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
        });

    } catch (error) {
        console.error('Error in faaahhh command:', error);
        await message.reply('❌ Une erreur est survenue lors de la tentative de lecture du son !');
    }
}
