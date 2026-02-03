#!/usr/bin/env node
/**
 * Script to build Pokemon categories cache from PokeAPI
 * Categories: legendary, mythical, starter, pseudo-legendary
 * 
 * Run: node scripts/build-pokemon-categories-cache.js
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const MAX_POKEMON_ID = 1025;
const OUTPUT_PATH = join(__dirname, '../data/pokemon-categories.json');

// Rate limiting helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return response.json();
            if (response.status === 404) return null;
            if (response.status === 429) {
                // Rate limited, wait longer
                await delay(2000 * (i + 1));
                continue;
            }
        } catch (error) {
            if (i === retries - 1) throw error;
            await delay(1000 * (i + 1));
        }
    }
    return null;
}

/**
 * Starter Pokemon base forms (first form of each starter line)
 * These are well-defined by generation and don't have an API field
 */
const STARTER_BASE_IDS = [
    // Gen 1: Bulbasaur, Charmander, Squirtle
    1, 4, 7,
    // Gen 2: Chikorita, Cyndaquil, Totodile
    152, 155, 158,
    // Gen 3: Treecko, Torchic, Mudkip
    252, 255, 258,
    // Gen 4: Turtwig, Chimchar, Piplup
    387, 390, 393,
    // Gen 5: Snivy, Tepig, Oshawott
    495, 498, 501,
    // Gen 6: Chespin, Fennekin, Froakie
    650, 653, 656,
    // Gen 7: Rowlet, Litten, Popplio
    722, 725, 728,
    // Gen 8: Grookey, Scorbunny, Sobble
    810, 813, 816,
    // Gen 9: Sprigatito, Fuecoco, Quaxly
    906, 909, 912
];

/**
 * Get all Pokemon in an evolution chain from a species
 */
async function getEvolutionChainIds(evolutionChainUrl) {
    const chainData = await fetchWithRetry(evolutionChainUrl);
    if (!chainData) return [];
    
    const ids = [];
    
    function traverseChain(node) {
        if (!node) return;
        // Extract ID from species URL
        const speciesUrl = node.species.url;
        const id = parseInt(speciesUrl.split('/').filter(Boolean).pop());
        if (id <= MAX_POKEMON_ID) {
            ids.push(id);
        }
        // Traverse all evolutions
        if (node.evolves_to) {
            for (const evolution of node.evolves_to) {
                traverseChain(evolution);
            }
        }
    }
    
    traverseChain(chainData.chain);
    return ids;
}

/**
 * Check if a Pokemon is a pseudo-legendary (600 base stat total, not legendary/mythical)
 */
async function isPseudoLegendary(pokemonId, isLegendary, isMythical) {
    if (isLegendary || isMythical) return false;
    
    const pokemonData = await fetchWithRetry(`${POKEAPI_BASE}/pokemon/${pokemonId}`);
    if (!pokemonData) return false;
    
    const baseStatTotal = pokemonData.stats.reduce((sum, stat) => sum + stat.base_stat, 0);
    return baseStatTotal === 600;
}

async function buildCache() {
    console.log('🚀 Building Pokemon categories cache...');
    console.log(`   Fetching data for ${MAX_POKEMON_ID} Pokemon from PokeAPI...\n`);
    
    const categories = {
        legendary: [],
        mythical: [],
        starter: [],
        pseudo: []
    };
    
    // Track evolution chains we've already processed for starters
    const processedStarterChains = new Set();
    
    // First pass: identify legendary, mythical, and collect starter evolution chains
    console.log('📊 Pass 1: Fetching species data (legendary, mythical)...');
    const speciesData = new Map();
    const batchSize = 50;
    
    for (let start = 1; start <= MAX_POKEMON_ID; start += batchSize) {
        const end = Math.min(start + batchSize - 1, MAX_POKEMON_ID);
        const promises = [];
        
        for (let id = start; id <= end; id++) {
            promises.push(
                fetchWithRetry(`${POKEAPI_BASE}/pokemon-species/${id}`)
                    .then(data => {
                        if (data) {
                            speciesData.set(id, data);
                            
                            if (data.is_legendary) {
                                categories.legendary.push(id);
                            }
                            if (data.is_mythical) {
                                categories.mythical.push(id);
                            }
                        }
                    })
                    .catch(() => {})
            );
        }
        
        await Promise.all(promises);
        
        const progress = Math.round((end / MAX_POKEMON_ID) * 100);
        process.stdout.write(`\r   Progress: ${progress}% (${end}/${MAX_POKEMON_ID})`);
        
        await delay(100);
    }
    console.log('\n');
    
    // Second pass: get full starter evolution lines
    console.log('📊 Pass 2: Building starter evolution lines...');
    for (const baseId of STARTER_BASE_IDS) {
        const species = speciesData.get(baseId);
        if (!species) continue;
        
        const chainUrl = species.evolution_chain?.url;
        if (!chainUrl || processedStarterChains.has(chainUrl)) continue;
        
        processedStarterChains.add(chainUrl);
        const evolutionIds = await getEvolutionChainIds(chainUrl);
        
        for (const id of evolutionIds) {
            if (!categories.starter.includes(id)) {
                categories.starter.push(id);
            }
        }
        
        process.stdout.write(`\r   Processed ${categories.starter.length} starters...`);
        await delay(50);
    }
    console.log('\n');
    
    // Third pass: identify pseudo-legendaries (600 base stats)
    console.log('📊 Pass 3: Checking for pseudo-legendaries (600 base stats)...');
    let pseudoChecked = 0;
    
    // Only check final evolutions of 3-stage lines (optimization)
    // Known pseudo-legendary final forms and their IDs for reference
    const potentialPseudos = [];
    
    for (const [id, species] of speciesData.entries()) {
        // Skip if legendary, mythical, or starter
        if (species.is_legendary || species.is_mythical) continue;
        if (categories.starter.includes(id)) continue;
        
        // Check base stats
        const isPseudo = await isPseudoLegendary(id, species.is_legendary, species.is_mythical);
        if (isPseudo) {
            categories.pseudo.push(id);
        }
        
        pseudoChecked++;
        if (pseudoChecked % 100 === 0) {
            process.stdout.write(`\r   Checked ${pseudoChecked} Pokemon, found ${categories.pseudo.length} pseudo-legendaries...`);
        }
        
        // Slow down to avoid rate limiting
        if (pseudoChecked % 50 === 0) {
            await delay(100);
        }
    }
    console.log(`\n   Found ${categories.pseudo.length} pseudo-legendaries\n`);
    
    // Sort all arrays
    categories.legendary.sort((a, b) => a - b);
    categories.mythical.sort((a, b) => a - b);
    categories.starter.sort((a, b) => a - b);
    categories.pseudo.sort((a, b) => a - b);
    
    // Create data directory if needed
    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    
    // Build the final cache object with metadata
    const cache = {
        version: 1,
        generatedAt: new Date().toISOString(),
        maxPokemonId: MAX_POKEMON_ID,
        categories: {
            legendary: {
                description: 'Legendary Pokemon (is_legendary from PokeAPI)',
                ids: categories.legendary
            },
            mythical: {
                description: 'Mythical/Fabulous Pokemon (is_mythical from PokeAPI)',
                ids: categories.mythical
            },
            starter: {
                description: 'Starter Pokemon and their evolutions (Gen 1-9)',
                ids: categories.starter
            },
            pseudo: {
                description: 'Pseudo-legendary Pokemon (600 base stat total, not legendary/mythical)',
                ids: categories.pseudo
            }
        }
    };
    
    // Write cache file
    await writeFile(OUTPUT_PATH, JSON.stringify(cache, null, 2), 'utf-8');
    
    console.log('✅ Cache built successfully!');
    console.log(`   - ${categories.legendary.length} legendary Pokemon`);
    console.log(`   - ${categories.mythical.length} mythical Pokemon`);
    console.log(`   - ${categories.starter.length} starter Pokemon (with evolutions)`);
    console.log(`   - ${categories.pseudo.length} pseudo-legendary Pokemon`);
    console.log(`   - Output: ${OUTPUT_PATH}`);
}

buildCache().catch(error => {
    console.error('❌ Error building cache:', error);
    process.exit(1);
});
