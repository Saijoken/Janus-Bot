import { BaseExtractor } from 'discord-player';
import https from 'https';
import http from 'http';
import { Readable } from 'stream';

/**
 * Custom YouTube extractor using Lavalink
 */
export class LavalinkYouTubeExtractor extends BaseExtractor {
    static identifier = 'com.discord-player.lavalinkyoutubeextractor';
    
    constructor() {
        super();
        this.lavalinkHost = process.env.LAVALINK_HOST || 'lavalink';
        this.lavalinkPort = parseInt(process.env.LAVALINK_PORT || '2333');
        this.lavalinkPassword = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
    }

    async validate(query, type) {
        // Check if it's a YouTube URL
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
        return youtubeRegex.test(query);
    }

    async handle(query, context) {
        try {
            console.log(`[LavalinkYouTubeExtractor] Handling query: ${query}`);
            // Use Lavalink's load endpoint to get track info
            const trackInfo = await this.loadTrack(query);
            
            console.log(`[LavalinkYouTubeExtractor] Lavalink response:`, JSON.stringify(trackInfo, null, 2));
            
            if (!trackInfo) {
                console.warn('[LavalinkYouTubeExtractor] No response from Lavalink');
                return this.emptyResponse();
            }
            
            // Check for error in response
            if (trackInfo.loadType === 'LOAD_FAILED' || trackInfo.loadType === 'NO_MATCHES') {
                console.warn(`[LavalinkYouTubeExtractor] Load failed: ${trackInfo.loadType}`, trackInfo.exception);
                return this.emptyResponse();
            }
            
            if (!trackInfo.tracks || trackInfo.tracks.length === 0) {
                console.warn('[LavalinkYouTubeExtractor] No tracks in response');
                return this.emptyResponse();
            }

            const track = trackInfo.tracks[0];
            const videoId = this.extractVideoId(track.info.uri);
            
            console.log(`[LavalinkYouTubeExtractor] Successfully loaded track: ${track.info.title}`);
            
            return {
                playlist: null,
                tracks: [{
                    title: track.info.title || 'Unknown',
                    author: track.info.author || 'Unknown',
                    url: track.info.uri,
                    duration: this.formatDuration(track.info.length),
                    thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null,
                    requestedBy: context.requestedBy
                }]
            };
        } catch (error) {
            console.error('[LavalinkYouTubeExtractor] Error:', error.message);
            console.error('[LavalinkYouTubeExtractor] Stack:', error.stack);
            return this.emptyResponse();
        }
    }

    async stream(track) {
        // discord-player v7 doesn't support Lavalink natively
        // We need to return a streamable URL or a Node.js stream
        // Since we're using Lavalink, we need to get the stream from Lavalink
        // However, discord-player expects a direct stream URL or stream object
        // For now, return the YouTube URL - discord-player might try to stream it directly
        // This won't work with Lavalink, but it's the only option with discord-player v7
        console.log(`[LavalinkYouTubeExtractor] stream() called for: ${track.url}`);
        console.log(`[LavalinkYouTubeExtractor] WARNING: discord-player v7 doesn't support Lavalink streaming directly`);
        return track.url;
    }
    
    async bridge(track, sourceExtractor) {
        // Bridge method for cross-extractor streaming
        // Return null to use default behavior
        return null;
    }

    emptyResponse() {
        return {
            playlist: null,
            tracks: []
        };
    }

    extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    formatDuration(ms) {
        if (!ms || ms === 0) return '0:00';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    loadTrack(query) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.lavalinkHost,
                port: this.lavalinkPort,
                path: '/v4/loadtracks?identifier=' + encodeURIComponent(query),
                method: 'GET',
                headers: {
                    'Authorization': this.lavalinkPassword,
                    'User-Agent': 'DiscordBot'
                }
            };

            const protocol = this.lavalinkPort === 443 ? https : http;
            
            const req = protocol.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            reject(new Error(`Lavalink returned status ${res.statusCode}: ${data}`));
                            return;
                        }
                        const result = JSON.parse(data);
                        resolve(result);
                    } catch (error) {
                        reject(new Error('Failed to parse Lavalink response: ' + error.message + ' | Data: ' + data.substring(0, 200)));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error('Lavalink request failed: ' + error.message));
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Lavalink request timeout'));
            });

            req.end();
        });
    }
}
