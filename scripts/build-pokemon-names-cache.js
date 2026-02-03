#!/usr/bin/env node
/**
 * Script to build the French Pokemon names cache from PokeAPI
 * Run: node scripts/build-pokemon-names-cache.js
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const MAX_POKEMON_ID = 1025;
const OUTPUT_PATH = join(__dirname, '../data/pokemon-names-fr.json');

async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return response.json();
            if (response.status === 404) return null;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return null;
}

async function buildCache() {
    console.log('🚀 Building French Pokemon names cache...');
    console.log(`   Fetching ${MAX_POKEMON_ID} Pokemon from PokeAPI...`);
    
    const cache = {};
    const batchSize = 50;
    let fetched = 0;
    let errors = 0;
    
    for (let start = 1; start <= MAX_POKEMON_ID; start += batchSize) {
        const end = Math.min(start + batchSize - 1, MAX_POKEMON_ID);
        const promises = [];
        
        for (let id = start; id <= end; id++) {
            promises.push(
                fetchWithRetry(`${POKEAPI_BASE}/pokemon-species/${id}`)
                    .then(data => {
                        if (data) {
                            const frName = data.names?.find(n => n.language.name === 'fr');
                            if (frName) {
                                cache[frName.name] = data.id;
                                fetched++;
                            }
                        }
                    })
                    .catch(() => { errors++; })
            );
        }
        
        await Promise.all(promises);
        
        // Progress indicator
        const progress = Math.round((end / MAX_POKEMON_ID) * 100);
        process.stdout.write(`\r   Progress: ${progress}% (${fetched} names fetched, ${errors} errors)`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n');
    
    // Create data directory if needed
    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    
    // Write cache file
    await writeFile(OUTPUT_PATH, JSON.stringify(cache, null, 2), 'utf-8');
    
    console.log(`✅ Cache built successfully!`);
    console.log(`   - ${Object.keys(cache).length} French names saved`);
    console.log(`   - Output: ${OUTPUT_PATH}`);
}

buildCache().catch(error => {
    console.error('❌ Error building cache:', error);
    process.exit(1);
});
