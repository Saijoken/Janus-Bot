import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3500;
const API_TOKEN = process.env.API_TOKEN || 'lyrics-secret';
const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN || '';

// Simple in-memory cache (expires after 1 hour)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Browser instance (reused for performance)
let browser = null;

async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        console.log('Launching new browser instance with stealth mode...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080',
                '--disable-blink-features=AutomationControlled'
            ]
        });
    }
    return browser;
}

// Search Genius API for song URL
async function searchGenius(query) {
    if (!GENIUS_ACCESS_TOKEN) {
        throw new Error('GENIUS_ACCESS_TOKEN not configured');
    }
    
    const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}` }
    });
    
    if (!response.ok) {
        throw new Error(`Genius API error: ${response.status}`);
    }
    
    const data = await response.json();
    const hits = data?.response?.hits || [];
    
    if (hits.length === 0) {
        return null;
    }
    
    const song = hits[0].result;
    return {
        title: song.title,
        artist: song.primary_artist?.name,
        url: song.url,
        thumbnail: song.song_art_image_thumbnail_url
    };
}

// Scrape lyrics from Genius page using Puppeteer
async function scrapeLyrics(geniusUrl) {
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    
    try {
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Set extra HTTP headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        // Navigate to the page
        console.log(`Navigating to: ${geniusUrl}`);
        await page.goto(geniusUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        
        // Wait a bit for Cloudflare challenge to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if we're on a Cloudflare challenge page
        const isCloudflare = await page.evaluate(() => {
            return document.title.includes('Just a moment') || 
                   document.body.textContent.includes('Checking your browser');
        });
        
        if (isCloudflare) {
            console.log('Cloudflare challenge detected, waiting...');
            // Wait longer for Cloudflare to resolve
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Try to navigate again
            await page.goto(geniusUrl, { 
                waitUntil: 'networkidle2',
                timeout: 60000 
            });
        }
        
        // Wait for lyrics container to appear (longer timeout)
        try {
            await page.waitForSelector('[data-lyrics-container="true"]', { timeout: 30000 });
        } catch (e) {
            // Try alternative selector
            console.log('Primary selector not found, trying alternatives...');
            const altSelectors = [
                '.lyrics', 
                '.Lyrics__Container', 
                '[class*="Lyrics__Container"]',
                '.song_body-lyrics'
            ];
            
            for (const selector of altSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    console.log(`Found lyrics with selector: ${selector}`);
                    break;
                } catch (e2) {
                    continue;
                }
            }
        }
        
        // Extract lyrics
        const lyrics = await page.evaluate(() => {
            // Try multiple selectors
            let containers = document.querySelectorAll('[data-lyrics-container="true"]');
            
            if (!containers.length) {
                containers = document.querySelectorAll('.Lyrics__Container-sc-1ynbvzw-1');
            }
            if (!containers.length) {
                containers = document.querySelectorAll('[class*="Lyrics__Container"]');
            }
            if (!containers.length) {
                containers = document.querySelectorAll('.lyrics');
            }
            
            let text = '';
            
            containers.forEach(container => {
                // Get text content, preserving line breaks
                const clone = container.cloneNode(true);
                
                // Replace <br> with newlines
                clone.querySelectorAll('br').forEach(br => {
                    br.replaceWith('\n');
                });
                
                // Remove annotations but keep text
                clone.querySelectorAll('a').forEach(a => {
                    a.replaceWith(a.textContent);
                });
                
                text += clone.textContent + '\n\n';
            });
            
            return text.trim();
        });
        
        return lyrics;
        
    } finally {
        await page.close();
    }
}

// Auth middleware
function authMiddleware(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    if (token !== API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', cached: cache.size });
});

// Lyrics endpoint
app.get('/lyrics', authMiddleware, async (req, res) => {
    const { artist, title, url } = req.query;
    
    if (!url && (!artist || !title)) {
        return res.status(400).json({ 
            error: 'Missing parameters. Provide either "url" or both "artist" and "title"' 
        });
    }
    
    try {
        let geniusUrl = url;
        let songInfo = null;
        
        // If no URL provided, search for the song
        if (!geniusUrl) {
            const query = `${title} ${artist}`;
            const cacheKey = `search:${query.toLowerCase()}`;
            
            // Check cache for search
            if (cache.has(cacheKey)) {
                const cached = cache.get(cacheKey);
                if (Date.now() - cached.timestamp < CACHE_TTL) {
                    songInfo = cached.data;
                    geniusUrl = songInfo?.url;
                }
            }
            
            if (!songInfo) {
                console.log(`Searching for: ${query}`);
                songInfo = await searchGenius(query);
                
                if (songInfo) {
                    cache.set(cacheKey, { data: songInfo, timestamp: Date.now() });
                    geniusUrl = songInfo.url;
                }
            }
        }
        
        if (!geniusUrl) {
            return res.status(404).json({ error: 'Song not found on Genius' });
        }
        
        // Check cache for lyrics
        const lyricsCacheKey = `lyrics:${geniusUrl}`;
        if (cache.has(lyricsCacheKey)) {
            const cached = cache.get(lyricsCacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log(`Returning cached lyrics for: ${geniusUrl}`);
                return res.json({
                    source: 'Genius (cached)',
                    ...songInfo,
                    lyrics: cached.data
                });
            }
        }
        
        // Scrape lyrics
        console.log(`Scraping lyrics from: ${geniusUrl}`);
        const lyrics = await scrapeLyrics(geniusUrl);
        
        if (!lyrics || lyrics.length === 0) {
            return res.status(404).json({ error: 'Could not extract lyrics from page' });
        }
        
        // Cache the result
        cache.set(lyricsCacheKey, { data: lyrics, timestamp: Date.now() });
        
        res.json({
            source: 'Genius',
            ...songInfo,
            url: geniusUrl,
            lyrics
        });
        
    } catch (error) {
        console.error('Error fetching lyrics:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Cleanup on exit
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`🎵 Genius Lyrics Scraper running on port ${PORT}`);
    console.log(`   API Token: ${API_TOKEN.substring(0, 4)}...`);
    console.log(`   Genius API: ${GENIUS_ACCESS_TOKEN ? 'configured' : 'NOT configured'}`);
});
