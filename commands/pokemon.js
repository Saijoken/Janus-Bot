import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import * as db from '../database.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

// Register Pokemon font
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
try {
    registerFont(join(__dirname, '../fonts/pokemon.ttf'), { family: 'Pokemon' });
    console.log('✅ Police Pokemon chargée');
} catch (e) {
    console.warn('⚠️ Police Pokemon non trouvée, utilisation de la police par défaut');
}

// PokeAPI base URL
const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

// Path to cache files
const FRENCH_NAMES_CACHE_PATH = join(__dirname, '../data/pokemon-names-fr.json');
const CATEGORIES_CACHE_PATH = join(__dirname, '../data/pokemon-categories.json');

// Cache for Pokemon data (to reduce API calls)
const pokemonCache = new Map();
const speciesCache = new Map();
// Cache for French names -> Pokemon ID mapping (loaded from file or built from API)
const frenchNameToIdCache = new Map();
// Reverse cache: Pokemon ID -> French name
const idToFrenchNameCache = new Map();
// Cache loading state
let frenchNamesCacheLoaded = false;
let frenchNamesCacheLoading = false;

// Pokemon categories cache (loaded from file)
let categoriesCache = null;
let categoriesCacheLoaded = false;

// Default fallback categories (used if cache fails to load)
const DEFAULT_CATEGORIES = {
    legendary: [144, 145, 146, 150, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381, 382, 383, 384, 480, 481, 482, 483, 484, 485, 486, 487, 488, 638, 639, 640, 641, 642, 643, 644, 645, 646, 716, 717, 718, 772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 800, 888, 889, 890, 891, 892, 894, 895, 896, 897, 898, 905, 1001, 1002, 1003, 1004, 1007, 1008, 1014, 1015, 1016, 1017, 1024],
    mythical: [151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649, 719, 720, 721, 801, 802, 807, 808, 809, 893, 1025],
    starter: [1, 2, 3, 4, 5, 6, 7, 8, 9, 152, 153, 154, 155, 156, 157, 158, 159, 160, 252, 253, 254, 255, 256, 257, 258, 259, 260, 387, 388, 389, 390, 391, 392, 393, 394, 395, 495, 496, 497, 498, 499, 500, 501, 502, 503, 650, 651, 652, 653, 654, 655, 656, 657, 658, 722, 723, 724, 725, 726, 727, 728, 729, 730, 810, 811, 812, 813, 814, 815, 816, 817, 818, 906, 907, 908, 909, 910, 911, 912, 913, 914],
    pseudo: [149, 248, 373, 376, 445, 635, 706, 784, 887, 998, 1018]
};

/**
 * Load Pokemon categories cache from file
 */
async function loadCategoriesCache() {
    if (categoriesCacheLoaded) return;
    
    try {
        if (existsSync(CATEGORIES_CACHE_PATH)) {
            const data = await readFile(CATEGORIES_CACHE_PATH, 'utf-8');
            categoriesCache = JSON.parse(data);
            categoriesCacheLoaded = true;
            
            const counts = Object.entries(categoriesCache.categories)
                .map(([k, v]) => `${k}: ${v.ids.length}`)
                .join(', ');
            console.log(`✅ Cache des catégories Pokémon chargé (${counts})`);
        } else {
            console.log('📋 Cache des catégories non trouvé, utilisation des valeurs par défaut');
            categoriesCache = null;
        }
    } catch (error) {
        console.error('⚠️ Erreur lors du chargement du cache des catégories:', error.message);
        categoriesCache = null;
    }
}

/**
 * Get Pokemon IDs for a category
 */
function getCategoryIds(category) {
    if (categoriesCache?.categories?.[category]?.ids) {
        return categoriesCache.categories[category].ids;
    }
    return DEFAULT_CATEGORIES[category] || [];
}

// Load categories cache at startup
loadCategoriesCache();

// ============================================================================
// RARITY SYSTEM - Probability Distribution
// ============================================================================
// Total must equal 100%
//
// Tier           Chance    Roll Range    Description
// ─────────────────────────────────────────────────────────────────────────────
// Legendary       1%       [0, 1)        Legendary Pokemon (from API)
// Mythical        3%       [1, 4)        Mythical/Fabulous Pokemon (from API)
// Rare            5%       [4, 9)        Starters + Pseudo-legendaries
// Uncommon       35%       [9, 44)       Evolved Pokemon (has pre-evolution)
// Common         56%       [44, 100)     Basic Pokemon (no pre-evolution)
// ─────────────────────────────────────────────────────────────────────────────
// Total:        100%
// ============================================================================

const RARITY_CHANCES = Object.freeze({
    legendary: 1,
    mythical: 3,
    rare: 5,        // starters + pseudo-legendaries
    uncommon: 35,   // evolved Pokemon (rarer than basic)
    common: 56      // basic Pokemon (most common)
});

// Validate percentages sum to 100 at startup
const TOTAL_CHANCE = Object.values(RARITY_CHANCES).reduce((sum, chance) => sum + chance, 0);
if (TOTAL_CHANCE !== 100) {
    throw new Error(`RARITY_CHANCES total is ${TOTAL_CHANCE}%, must be exactly 100%!`);
}

// Pre-compute cumulative thresholds for efficient lookup
const RARITY_THRESHOLDS = Object.freeze({
    legendary: RARITY_CHANCES.legendary,                                          // 1
    mythical: RARITY_CHANCES.legendary + RARITY_CHANCES.mythical,                 // 4
    rare: RARITY_CHANCES.legendary + RARITY_CHANCES.mythical + RARITY_CHANCES.rare, // 9
    uncommon: RARITY_CHANCES.legendary + RARITY_CHANCES.mythical + RARITY_CHANCES.rare + RARITY_CHANCES.uncommon, // 44
    common: 100                                                                    // 100
});

// Pokemon rarity tiers (dynamically uses cache)
const RARITY_TIERS = {
    legendary: {
        get ids() { return getCategoryIds('legendary'); },
        chance: RARITY_CHANCES.legendary,
        color: 0xFFD700,
        emoji: '🌟'
    },
    mythical: {
        get ids() { return getCategoryIds('mythical'); },
        chance: RARITY_CHANCES.mythical,
        color: 0xFF00FF,
        emoji: '✨'
    },
    rare: {
        // Combined: pseudo-legendaries + starters
        get ids() { return [...getCategoryIds('pseudo'), ...getCategoryIds('starter')]; },
        chance: RARITY_CHANCES.rare,
        color: 0x9B59B6,
        emoji: '💎'
    },
    uncommon: {
        // Evolved Pokemon (determined dynamically)
        chance: RARITY_CHANCES.uncommon,
        color: 0x3498DB,
        emoji: '🔵'
    },
    common: {
        // Basic Pokemon, first stages (determined dynamically)
        chance: RARITY_CHANCES.common,
        color: 0x2ECC71,
        emoji: '🟢'
    }
};

// Shiny chance (1/100)
const SHINY_CHANCE = 1 / 100;

// Catch cooldown in minutes
const CATCH_COOLDOWN = 15;

// Max Pokemon ID to catch (Gen 1-9 = 1025)
const MAX_POKEMON_ID = 1025;

// Pseudo-legendaries list (dynamically from cache)
function getPseudoLegendaries() {
    return getCategoryIds('pseudo');
}

// Evolution costs (coins)
const EVOLVE_COST = {
    normal: { toSecond: 3000, toThird: 10000, mega: 20000 },
    special: { toSecond: 10000, toThird: 20000, mega: 50000 } // starter, pseudo, legendary, mythical
};

// Mega stone shop: stoneId -> { frenchName, baseSpeciesId, priceTier }
// priceTier: 1=weak 5000, 2=medium 15000, 3=strong 30000, 4=legendary 50000
const MEGA_STONE_PRICES = { 1: 5000, 2: 15000, 3: 30000, 4: 50000 };
const MEGA_STONES = [
    { stoneId: 'venusaurite', frenchName: 'Floramite', baseSpeciesId: 3, priceTier: 1 },
    { stoneId: 'charizardite-x', frenchName: 'Dracaufeunite X', baseSpeciesId: 6, priceTier: 3 },
    { stoneId: 'charizardite-y', frenchName: 'Dracaufeunite Y', baseSpeciesId: 6, priceTier: 3 },
    { stoneId: 'blastoisinite', frenchName: 'Tortankite', baseSpeciesId: 9, priceTier: 1 },
    { stoneId: 'beedrillite', frenchName: 'Dardargnite', baseSpeciesId: 15, priceTier: 1 },
    { stoneId: 'pidgeotite', frenchName: 'Roucarnite', baseSpeciesId: 18, priceTier: 1 },
    { stoneId: 'alakazite', frenchName: 'Alakazamite', baseSpeciesId: 65, priceTier: 2 },
    { stoneId: 'slowbronite', frenchName: 'Flagadossite', baseSpeciesId: 80, priceTier: 2 },
    { stoneId: 'gengarite', frenchName: 'Ectoplasmite', baseSpeciesId: 94, priceTier: 3 },
    { stoneId: 'kangaskhanite', frenchName: 'Kangoureskite', baseSpeciesId: 115, priceTier: 2 },
    { stoneId: 'pinsirite', frenchName: 'Scarabrutite', baseSpeciesId: 127, priceTier: 2 },
    { stoneId: 'gyaradosite', frenchName: 'Léviatorite', baseSpeciesId: 130, priceTier: 2 },
    { stoneId: 'aerodactylite', frenchName: 'Ptéraite', baseSpeciesId: 142, priceTier: 2 },
    { stoneId: 'mewtwonite-x', frenchName: 'Mewtwoite X', baseSpeciesId: 150, priceTier: 4 },
    { stoneId: 'mewtwonite-y', frenchName: 'Mewtwoite Y', baseSpeciesId: 150, priceTier: 4 },
    { stoneId: 'ampharosite', frenchName: 'Pharampite', baseSpeciesId: 181, priceTier: 2 },
    { stoneId: 'steelixite', frenchName: 'Steelixite', baseSpeciesId: 208, priceTier: 2 },
    { stoneId: 'scizorite', frenchName: 'Cizayoxite', baseSpeciesId: 212, priceTier: 3 },
    { stoneId: 'heracronite', frenchName: 'Scarhinoite', baseSpeciesId: 214, priceTier: 2 },
    { stoneId: 'houndoominite', frenchName: 'Démolossite', baseSpeciesId: 229, priceTier: 2 },
    { stoneId: 'tyranitarite', frenchName: 'Tyranocivite', baseSpeciesId: 248, priceTier: 3 },
    { stoneId: 'blazikenite', frenchName: 'Braségalite', baseSpeciesId: 257, priceTier: 3 },
    { stoneId: 'gardevoirite', frenchName: 'Gardevoirite', baseSpeciesId: 282, priceTier: 3 },
    { stoneId: 'mawilite', frenchName: 'Mysdibulite', baseSpeciesId: 303, priceTier: 2 },
    { stoneId: 'aggronite', frenchName: 'Galekingite', baseSpeciesId: 306, priceTier: 2 },
    { stoneId: 'medichamite', frenchName: 'Charminite', baseSpeciesId: 308, priceTier: 2 },
    { stoneId: 'manectrite', frenchName: 'Élecsprintite', baseSpeciesId: 310, priceTier: 2 },
    { stoneId: 'banettite', frenchName: 'Branettite', baseSpeciesId: 354, priceTier: 2 },
    { stoneId: 'absolite', frenchName: 'Absolite', baseSpeciesId: 359, priceTier: 2 },
    { stoneId: 'latiasite', frenchName: 'Latiasite', baseSpeciesId: 380, priceTier: 4 },
    { stoneId: 'latiosite', frenchName: 'Latiosite', baseSpeciesId: 381, priceTier: 4 },
    { stoneId: 'garchompite', frenchName: 'Carchacrokite', baseSpeciesId: 445, priceTier: 3 },
    { stoneId: 'lucarionite', frenchName: 'Lucarite', baseSpeciesId: 448, priceTier: 3 },
    { stoneId: 'abomasite', frenchName: 'Blizzarite', baseSpeciesId: 460, priceTier: 2 },
    { stoneId: 'metagrossite', frenchName: 'Métalossite', baseSpeciesId: 376, priceTier: 3 },
    { stoneId: 'salamencite', frenchName: 'Drattakite', baseSpeciesId: 373, priceTier: 3 },
    { stoneId: 'lopunnite', frenchName: 'Lockpinite', baseSpeciesId: 428, priceTier: 2 },
    { stoneId: 'galladite', frenchName: 'Gallamite', baseSpeciesId: 475, priceTier: 3 },
    { stoneId: 'audinite', frenchName: 'Nanméouite', baseSpeciesId: 531, priceTier: 1 },
    { stoneId: 'diancite', frenchName: 'Diancite', baseSpeciesId: 719, priceTier: 4 },
    { stoneId: 'cameruptite', frenchName: 'Cameruptite', baseSpeciesId: 323, priceTier: 2 },
    { stoneId: 'sharpedonite', frenchName: 'Sharpedite', baseSpeciesId: 319, priceTier: 2 },
    { stoneId: 'sceptilite', frenchName: 'Jungkoite', baseSpeciesId: 254, priceTier: 3 },
    { stoneId: 'swampertite', frenchName: 'Laggronite', baseSpeciesId: 260, priceTier: 3 },
    { stoneId: 'sableyeite', frenchName: 'Ténéfixite', baseSpeciesId: 302, priceTier: 2 },
    { stoneId: 'altarianite', frenchName: 'Altarite', baseSpeciesId: 334, priceTier: 2 },
    { stoneId: 'glalitite', frenchName: 'Oniglalite', baseSpeciesId: 362, priceTier: 2 },
];

// QTE settings for legendary catches
const QTE_TIME_LIMIT = 3000; // 3 seconds to react

// Active QTE sessions
const activeQTEs = new Map();

// Evolution chain cache
const evolutionChainCache = new Map();

/**
 * Fetch Pokemon data from PokeAPI with caching
 */
async function fetchPokemon(idOrName) {
    const key = String(idOrName).toLowerCase();
    
    if (pokemonCache.has(key)) {
        return pokemonCache.get(key);
    }
    
    try {
        const response = await fetch(`${POKEAPI_BASE}/pokemon/${key}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        pokemonCache.set(key, data);
        pokemonCache.set(String(data.id), data);
        pokemonCache.set(data.name, data);
        
        return data;
    } catch (error) {
        console.error('Error fetching Pokemon:', error);
        return null;
    }
}

/**
 * Fetch evolution chain by chain URL (from species)
 * @param {string} chainUrl - e.g. https://pokeapi.co/api/v2/evolution-chain/2/
 * @returns {Promise<Object|null>} Chain object or null
 */
async function fetchEvolutionChain(chainUrl) {
    if (!chainUrl) return null;
    const id = chainUrl.split('/').filter(Boolean).pop();
    if (evolutionChainCache.has(id)) return evolutionChainCache.get(id);
    try {
        const response = await fetch(`${POKEAPI_BASE}/evolution-chain/${id}`);
        if (!response.ok) return null;
        const data = await response.json();
        evolutionChainCache.set(id, data);
        return data;
    } catch (error) {
        console.error('Error fetching evolution chain:', error);
        return null;
    }
}

/**
 * Find the node in the evolution chain that matches the given species ID
 * @param {Object} node - Chain node { species: { url }, evolves_to: [] }
 * @param {number} targetId - Species ID to find
 * @param {number} depth - Current depth (stage - 1)
 * @returns {{ node: Object, stage: number } | null}
 */
function findNodeInChain(node, targetId, depth = 0) {
    if (!node?.species?.url) return null;
    const speciesId = parseInt(node.species.url.split('/').filter(Boolean).pop(), 10);
    if (speciesId === targetId) return { node, stage: depth + 1 };
    for (const child of (node.evolves_to || [])) {
        const result = findNodeInChain(child, targetId, depth + 1);
        if (result) return result;
    }
    return null;
}

/**
 * Get all possible next evolutions from a chain node
 * @param {Object} node - Chain node with evolves_to array
 * @returns {number[]} Array of species IDs that this Pokemon can evolve into
 */
function getNextEvolutions(node) {
    if (!node?.evolves_to?.length) return [];
    return node.evolves_to.map(child => {
        const id = parseInt(child.species.url.split('/').filter(Boolean).pop(), 10);
        return isNaN(id) ? null : id;
    }).filter(Boolean);
}

/**
 * Check if a Pokemon is at its final evolution stage (no further evolutions)
 * @param {Object} node - Chain node
 * @returns {boolean}
 */
function isFinalStage(node) {
    return !node?.evolves_to?.length;
}

/**
 * Get evolution stage (1, 2, or 3), all possible next evolutions, and mega info
 * @param {number} pokemonId - Current species id
 * @param {Object} species - Species data (with evolution_chain)
 * @returns {Promise<{ stage: number, nextEvolutions: number[], isFinal: boolean, canMega: boolean, megaStones: Object[] }>}
 */
async function getEvolutionInfo(pokemonId, species) {
    const chainData = species?.evolution_chain?.url
        ? await fetchEvolutionChain(species.evolution_chain.url)
        : null;
    
    let stage = 1;
    let nextEvolutions = [];
    let isFinal = true;
    
    if (chainData?.chain) {
        const found = findNodeInChain(chainData.chain, pokemonId);
        if (found) {
            stage = found.stage;
            nextEvolutions = getNextEvolutions(found.node);
            isFinal = isFinalStage(found.node);
        }
    }
    
    const megaStonesForSpecies = MEGA_STONES.filter(s => s.baseSpeciesId === pokemonId);
    // Can mega evolve if has mega stones AND is at final stage (no normal evolutions left)
    const canMega = megaStonesForSpecies.length > 0 && isFinal;
    
    return { stage, nextEvolutions, isFinal, canMega, megaStones: megaStonesForSpecies };
}

/**
 * Check if Pokemon is special (starter, pseudo-legendary, legendary, mythical) for evolution cost
 */
function isSpecialPokemon(pokemonId) {
    if (getCategoryIds('legendary').includes(pokemonId)) return true;
    if (getCategoryIds('mythical').includes(pokemonId)) return true;
    if (getCategoryIds('pseudo').includes(pokemonId)) return true;
    if (getCategoryIds('starter').includes(pokemonId)) return true;
    return false;
}

/**
 * Coin reward for catching a Pokemon (economy farmable)
 */
function getCatchCoinReward(rarity) {
    const name = rarity?.name || '';
    if (name === 'Légendaire' || name === 'Fabuleux') return 300;
    if (name === 'Pseudo-Légendaire' || name === 'Starter') return 150;
    if (name === 'Peu commun') return 80;
    return 50; // Commun
}

/**
 * Remove accents from a string for accent-insensitive comparison
 */
function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Load French names cache from file
 */
async function loadFrenchNamesCache() {
    if (frenchNamesCacheLoaded || frenchNamesCacheLoading) return;
    frenchNamesCacheLoading = true;
    
    try {
        if (existsSync(FRENCH_NAMES_CACHE_PATH)) {
            const data = await readFile(FRENCH_NAMES_CACHE_PATH, 'utf-8');
            const cache = JSON.parse(data);
            
            for (const [frName, id] of Object.entries(cache)) {
                frenchNameToIdCache.set(frName.toLowerCase(), id);
                frenchNameToIdCache.set(removeAccents(frName.toLowerCase()), id);
                idToFrenchNameCache.set(id, frName);
            }
            
            console.log(`✅ Cache des noms français chargé (${Object.keys(cache).length} Pokémon)`);
            frenchNamesCacheLoaded = true;
        } else {
            console.log('📋 Cache des noms français non trouvé, il sera construit au fur et à mesure');
        }
    } catch (error) {
        console.error('⚠️ Erreur lors du chargement du cache des noms français:', error.message);
    }
    
    frenchNamesCacheLoading = false;
}

/**
 * Save French names cache to file
 */
async function saveFrenchNamesCache() {
    try {
        // Create data directory if it doesn't exist
        const dataDir = join(__dirname, '../data');
        const { mkdir } = await import('fs/promises');
        await mkdir(dataDir, { recursive: true });
        
        // Build cache object from idToFrenchNameCache
        const cache = {};
        for (const [id, frName] of idToFrenchNameCache.entries()) {
            cache[frName] = id;
        }
        
        await writeFile(FRENCH_NAMES_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
        console.log(`💾 Cache des noms français sauvegardé (${Object.keys(cache).length} Pokémon)`);
    } catch (error) {
        console.error('⚠️ Erreur lors de la sauvegarde du cache:', error.message);
    }
}

/**
 * Build French names cache by fetching all species from PokeAPI
 * This is called once to populate the cache file
 */
export async function buildFrenchNamesCache(message) {
    if (message) {
        await message.reply('🔄 Construction du cache des noms français... Cela peut prendre quelques minutes.');
    }
    
    const batchSize = 50;
    let newEntries = 0;
    
    for (let start = 1; start <= MAX_POKEMON_ID; start += batchSize) {
        const end = Math.min(start + batchSize - 1, MAX_POKEMON_ID);
        const promises = [];
        
        for (let id = start; id <= end; id++) {
            if (!idToFrenchNameCache.has(id)) {
                promises.push(
                    fetch(`${POKEAPI_BASE}/pokemon-species/${id}`)
                        .then(res => res.ok ? res.json() : null)
                        .then(data => {
                            if (data) {
                                const frName = data.names?.find(n => n.language.name === 'fr');
                                if (frName) {
                                    frenchNameToIdCache.set(frName.name.toLowerCase(), data.id);
                                    frenchNameToIdCache.set(removeAccents(frName.name.toLowerCase()), data.id);
                                    idToFrenchNameCache.set(data.id, frName.name);
                                    newEntries++;
                                }
                            }
                        })
                        .catch(() => {})
                );
            }
        }
        
        if (promises.length > 0) {
            await Promise.all(promises);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (message && start % 200 === 1) {
            console.log(`📊 Cache: ${start}-${end}/${MAX_POKEMON_ID}...`);
        }
    }
    
    await saveFrenchNamesCache();
    frenchNamesCacheLoaded = true;
    
    if (message) {
        await message.reply(`✅ Cache des noms français construit ! ${newEntries} nouveaux noms ajoutés.`);
    }
    
    return newEntries;
}

/**
 * Build Pokemon categories cache (legendary, mythical, starter, pseudo)
 * Runs the external script to fetch data from PokeAPI
 */
export async function buildCategoriesCache(message) {
    const { spawn } = await import('child_process');
    
    if (message) {
        await message.reply('🔄 Construction du cache des catégories Pokémon... Cela peut prendre 1-2 minutes.');
    }
    
    return new Promise((resolve, reject) => {
        const scriptPath = join(__dirname, '../scripts/build-pokemon-categories-cache.js');
        const child = spawn('node', [scriptPath], { cwd: join(__dirname, '..') });
        
        let output = '';
        child.stdout.on('data', (data) => { output += data.toString(); });
        child.stderr.on('data', (data) => { output += data.toString(); });
        
        child.on('close', async (code) => {
            if (code === 0) {
                // Reload the cache
                categoriesCacheLoaded = false;
                await loadCategoriesCache();
                
                if (message) {
                    const counts = categoriesCache?.categories 
                        ? Object.entries(categoriesCache.categories).map(([k, v]) => `${k}: ${v.ids.length}`).join(', ')
                        : 'inconnu';
                    await message.reply(`✅ Cache des catégories reconstruit ! (${counts})`);
                }
                resolve(true);
            } else {
                if (message) {
                    await message.reply(`❌ Erreur lors de la construction du cache (code ${code})`);
                }
                reject(new Error(`Script exited with code ${code}`));
            }
        });
    });
}

// Load cache at module initialization
loadFrenchNamesCache();

/**
 * Fetch Pokemon species data (for descriptions)
 */
async function fetchSpecies(idOrName) {
    const key = String(idOrName).toLowerCase();
    
    if (speciesCache.has(key)) {
        return speciesCache.get(key);
    }
    
    try {
        const response = await fetch(`${POKEAPI_BASE}/pokemon-species/${key}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        speciesCache.set(key, data);
        speciesCache.set(String(data.id), data);
        
        // Cache French name for reverse lookup (both with and without accents)
        const frName = data.names?.find(n => n.language.name === 'fr');
        if (frName) {
            frenchNameToIdCache.set(frName.name.toLowerCase(), data.id);
            frenchNameToIdCache.set(removeAccents(frName.name.toLowerCase()), data.id);
            idToFrenchNameCache.set(data.id, frName.name);
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching species:', error);
        return null;
    }
}

/**
 * Pick a random element from an array
 * @param {Array} arr - Array to pick from
 * @returns {*} Random element or null if array is empty
 */
function randomFromArray(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get a random Pokemon ID based on rarity distribution.
 * 
 * Uses pre-computed cumulative thresholds for O(1) tier determination.
 * Roll is in [0, 100), each tier occupies exactly its configured percentage.
 * 
 * Distribution:
 *   [0, 1)   → Legendary (1%)
 *   [1, 4)   → Mythical (3%)
 *   [4, 9)   → Rare/Starter+Pseudo (5%)
 *   [9, 44)  → Uncommon (35%) - falls through to random
 *   [44, 100) → Common (56%) - falls through to random
 * 
 * @returns {number} Pokemon ID
 */
function getRandomPokemonId() {
    const roll = Math.random() * 100;
    
    // Legendary: 1% chance [0, 1)
    if (roll < RARITY_THRESHOLDS.legendary) {
        const id = randomFromArray(getCategoryIds('legendary'));
        if (id) return id;
    }
    
    // Mythical: 3% chance [1, 4)
    if (roll < RARITY_THRESHOLDS.mythical) {
        const id = randomFromArray(getCategoryIds('mythical'));
        if (id) return id;
    }
    
    // Rare (Starters + Pseudo-legendaries): 5% chance [4, 9)
    if (roll < RARITY_THRESHOLDS.rare) {
        const pseudoIds = getCategoryIds('pseudo');
        const starterIds = getCategoryIds('starter');
        
        // Within rare tier: ~12% pseudo-legendary, ~88% starter
        // (based on relative counts: 11 pseudo vs 81 starters)
        const totalRare = pseudoIds.length + starterIds.length;
        if (totalRare > 0) {
            const pseudoChance = pseudoIds.length / totalRare;
            if (Math.random() < pseudoChance) {
                return randomFromArray(pseudoIds) || randomFromArray(starterIds);
            }
            return randomFromArray(starterIds) || randomFromArray(pseudoIds);
        }
    }
    
    // Uncommon (35%) + Common (56%): random from all Pokemon
    // The actual rarity label is determined by getRarity() based on evolution status
    return Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
}

/**
 * Get rarity info for a Pokemon
 * @param {number} pokemonId - The Pokemon ID
 * @param {object} species - Optional species data to determine if evolved
 */
function getRarity(pokemonId, species = null) {
    if (getCategoryIds('legendary').includes(pokemonId)) {
        return { name: 'Légendaire', ...RARITY_TIERS.legendary };
    }
    if (getCategoryIds('mythical').includes(pokemonId)) {
        return { name: 'Fabuleux', ...RARITY_TIERS.mythical };
    }
    
    // Check pseudo-legendaries
    if (getCategoryIds('pseudo').includes(pokemonId)) {
        return { name: 'Pseudo-Légendaire', ...RARITY_TIERS.rare };
    }
    
    // Check starters
    if (getCategoryIds('starter').includes(pokemonId)) {
        return { name: 'Starter', ...RARITY_TIERS.rare };
    }
    
    // If we have species data, check if it's an evolution
    if (species) {
        // Pokemon with a pre-evolution are "Peu commun" (evolved Pokemon)
        if (species.evolves_from_species) {
            return { name: 'Peu commun', ...RARITY_TIERS.uncommon };
        }
        // Base Pokemon (no pre-evolution) are "Commun"
        return { name: 'Commun', ...RARITY_TIERS.common };
    }
    
    // Fallback when no species data: use configured ratio
    // uncommon / (uncommon + common) = probability of uncommon
    const uncommonRatio = RARITY_CHANCES.uncommon / (RARITY_CHANCES.uncommon + RARITY_CHANCES.common);
    if (Math.random() < uncommonRatio) {
        return { name: 'Peu commun', ...RARITY_TIERS.uncommon };
    }
    
    return { name: 'Commun', ...RARITY_TIERS.common };
}

/**
 * Check if Pokemon requires QTE to catch (only legendary and mythical, not pseudo-legendary)
 */
function requiresQTE(pokemonId) {
    return RARITY_TIERS.legendary.ids.includes(pokemonId) ||
           RARITY_TIERS.mythical.ids.includes(pokemonId);
}

/**
 * Format Pokemon types in French
 */
function formatTypes(types) {
    const typeTranslations = {
        normal: 'Normal', fire: 'Feu', water: 'Eau', electric: 'Électrik',
        grass: 'Plante', ice: 'Glace', fighting: 'Combat', poison: 'Poison',
        ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte',
        rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres',
        steel: 'Acier', fairy: 'Fée'
    };
    
    return types.map(t => typeTranslations[t.type.name] || t.type.name).join(' / ');
}

/**
 * Get French description from species data
 */
function getFrenchDescription(species) {
    if (!species?.flavor_text_entries) return null;
    
    // Try French first
    const frEntry = species.flavor_text_entries.find(e => e.language.name === 'fr');
    if (frEntry) return frEntry.flavor_text.replace(/\n|\f/g, ' ');
    
    // Fallback to English
    const enEntry = species.flavor_text_entries.find(e => e.language.name === 'en');
    if (enEntry) return enEntry.flavor_text.replace(/\n|\f/g, ' ');
    
    return null;
}

/**
 * Get French name from species data or cache
 */
function getFrenchName(species, fallbackName) {
    // First check if we have it in the cache (by ID)
    if (species?.id && idToFrenchNameCache.has(species.id)) {
        return idToFrenchNameCache.get(species.id);
    }
    
    // Try to get from species data
    if (species?.names) {
        const frName = species.names.find(n => n.language.name === 'fr');
        if (frName) {
            // Update cache
            if (species.id) {
                frenchNameToIdCache.set(frName.name.toLowerCase(), species.id);
                frenchNameToIdCache.set(removeAccents(frName.name.toLowerCase()), species.id);
                idToFrenchNameCache.set(species.id, frName.name);
            }
            return frName.name;
        }
    }
    
    return capitalize(fallbackName);
}

/**
 * Find Pokemon by name (French or English) or ID
 * Uses the French names cache for reverse lookup
 */
async function findPokemon(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const noAccentQuery = removeAccents(normalizedQuery);
    
    // First, try direct lookup (English name or ID)
    let pokemon = await fetchPokemon(normalizedQuery);
    if (pokemon) return pokemon;
    
    // Check French names cache (supports both with and without accents)
    if (frenchNameToIdCache.has(normalizedQuery)) {
        const pokemonId = frenchNameToIdCache.get(normalizedQuery);
        return await fetchPokemon(pokemonId);
    }
    
    // Try without accents
    if (frenchNameToIdCache.has(noAccentQuery)) {
        const pokemonId = frenchNameToIdCache.get(noAccentQuery);
        return await fetchPokemon(pokemonId);
    }
    
    // If cache is loaded but name not found, try fetching by ID range
    // This helps find Pokemon not yet in cache
    if (frenchNamesCacheLoaded) {
        return null;
    }
    
    // Cache not fully loaded - try a slower search through the API
    // This is a fallback for when the cache hasn't been built yet
    return null;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format time remaining
 */
function formatTimeRemaining(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

// ==================== COMMANDS ====================

/**
 * Internal catch logic - used by both catch and test commands
 */
async function performCatch(message, options = {}) {
    const { forceMode = null, isTest = false } = options;
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Check cooldown (skip for test mode)
    if (!isTest) {
        const cooldownCheck = await db.canCatchPokemon(userId, guildId, CATCH_COOLDOWN);
        
        if (!cooldownCheck.canCatch) {
            const embed = new EmbedBuilder()
                .setTitle('⏰ Patience, dresseur !')
                .setDescription(`Tu dois attendre avant de pouvoir capturer un autre Pokémon !\n\n⏱️ **Temps restant:** ${formatTimeRemaining(cooldownCheck.remainingTime)}`)
                .setColor(0xff9900)
                .setFooter({ text: `Cooldown: ${CATCH_COOLDOWN} minutes entre chaque capture` });
            
            return message.reply({ embeds: [embed] });
        }
    }
    
    // Show "searching" message
    const searchEmbed = new EmbedBuilder()
        .setDescription('🔍 Tu cherches un Pokémon dans les hautes herbes...')
        .setColor(0x3498db);
    
    const searchMsg = await message.reply({ embeds: [searchEmbed] });
    
    // Get Pokemon ID based on mode
    let pokemonId;
    if (forceMode === 'legendary') {
        // Force legendary or mythical for testing (not pseudo-legendary)
        const allLegendary = [...RARITY_TIERS.legendary.ids, ...RARITY_TIERS.mythical.ids];
        pokemonId = allLegendary[Math.floor(Math.random() * allLegendary.length)];
    } else {
        pokemonId = getRandomPokemonId();
    }
    
    const pokemon = await fetchPokemon(pokemonId);
    
    if (!pokemon) {
        const errorEmbed = new EmbedBuilder()
            .setDescription('❌ Aucun Pokémon n\'est apparu... Réessaie plus tard !')
            .setColor(0xff0000);
        return searchMsg.edit({ embeds: [errorEmbed] });
    }
    
    // Fetch species for description and rarity check
    const species = await fetchSpecies(pokemon.id);
    const description = getFrenchDescription(species);
    
    // Determine if shiny and get rarity
    const isShiny = Math.random() < SHINY_CHANCE;
    const rarity = getRarity(pokemon.id, species);
    const needsQTE = requiresQTE(pokemon.id);
    
    // Get sprite URL
    const spriteUrl = isShiny 
        ? pokemon.sprites.front_shiny || pokemon.sprites.front_default
        : pokemon.sprites.front_default;
    
    // Get French name
    const frenchName = getFrenchName(species, pokemon.name);
    
    // If legendary/pseudo-legendary, show QTE
    if (needsQTE) {
        const qteEmbed = new EmbedBuilder()
            .setTitle(`${isShiny ? '✨ ' : ''}${rarity.emoji} Un ${frenchName} sauvage apparaît !`)
            .setDescription(
                `**⚡ RÉACTION RAPIDE !**\n\n` +
                `Un **${rarity.name}** est apparu !\n` +
                `Appuie vite sur le bouton pour le capturer !\n\n` +
                `⏱️ Tu as **${QTE_TIME_LIMIT / 1000} secondes** !`
            )
            .setThumbnail(spriteUrl)
            .setColor(0xFF0000)
            .setFooter({ text: isTest ? '🧪 MODE TEST - Pas de capture réelle' : 'Vite ! Le Pokémon va s\'enfuir !' });
        
        const qteId = `qte_${Date.now()}_${userId}`;
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(qteId)
                    .setLabel('🎯 ATTRAPER !')
                    .setStyle(ButtonStyle.Success)
            );
        
        await searchMsg.edit({ embeds: [qteEmbed], components: [row] });
        
        // Store QTE data
        activeQTEs.set(qteId, {
            userId: userId,
            pokemon,
            frenchName,
            isShiny,
            rarity,
            spriteUrl,
            description,
            species,
            isTest,
            messageId: searchMsg.id,
            startTime: Date.now()
        });
        
        // Set timeout to remove button and show escape message
        setTimeout(async () => {
            const qteData = activeQTEs.get(qteId);
            if (qteData) {
                activeQTEs.delete(qteId);
                
                const escapeEmbed = new EmbedBuilder()
                    .setTitle(`💨 ${frenchName} s'est enfui !`)
                    .setDescription(
                        `Tu n'as pas été assez rapide...\n` +
                        `Le **${rarity.name}** a pris la fuite !\n\n` +
                        `*Réessaie avec \`$catch\` !*`
                    )
                    .setThumbnail(spriteUrl)
                    .setColor(0x808080)
                    .setFooter({ text: isTest ? '🧪 MODE TEST' : 'Les Pokémon rares demandent des réflexes !' });
                
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('expired')
                            .setLabel('⏰ Trop tard...')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                
                await searchMsg.edit({ embeds: [escapeEmbed], components: [disabledRow] }).catch(() => {});
            }
        }, QTE_TIME_LIMIT);
        
        return;
    }
    
    // Normal Pokemon - direct catch (skip for test mode)
    if (!isTest) {
        const catchResult = await db.addPokemonCatch(userId, guildId, {
            id: pokemon.id,
            name: pokemon.name,
            isShiny
        });
        const coinReward = getCatchCoinReward(rarity);
        const newBalance = await db.addMoney(userId, guildId, coinReward, 'pokemon_catch', `Capture: ${frenchName}`);
        
        const counts = await db.getPokemonCounts(userId, guildId);
        
        const embed = new EmbedBuilder()
            .setTitle(`${isShiny ? '✨ SHINY ! ' : ''}${rarity.emoji} Un ${frenchName} sauvage est apparu !`)
            .setDescription(
                `**Tu as capturé ${isShiny ? '✨ ' : ''}${frenchName} !**\n\n` +
                `📊 **Infos:**\n` +
                `• Type: ${formatTypes(pokemon.types)}\n` +
                `• Rareté: ${rarity.name}\n` +
                `• N° Pokédex: #${pokemon.id}\n` +
                `💰 **+${coinReward.toLocaleString()} coins** (solde: ${newBalance.toLocaleString()})\n` +
                (description ? `\n📖 *${description}*` : '') +
                `\n\n${catchResult.isNewEntry ? '🆕 **Nouveau Pokémon ajouté au Pokédex !**' : ''}` +
                `${catchResult.isFirstShiny ? '\n⭐ **Premier shiny de cette espèce !**' : ''}`
            )
            .setThumbnail(spriteUrl)
            .setColor(isShiny ? 0xFFD700 : rarity.color)
            .setFooter({ text: `Pokédex: ${counts.unique}/898 • Total attrapés: ${counts.total} • Shinies: ${counts.shiny}` });
        
        if (isShiny) {
            embed.setAuthor({ name: '✨ SHINY POKÉMON ! ✨' });
        }
        
        await searchMsg.edit({ embeds: [embed] });
    } else {
        // Test mode - show what would happen
        const embed = new EmbedBuilder()
            .setTitle(`🧪 TEST: ${isShiny ? '✨ ' : ''}${rarity.emoji} ${frenchName}`)
            .setDescription(
                `**Pokémon:** ${frenchName}\n` +
                `**Type:** ${formatTypes(pokemon.types)}\n` +
                `**Rareté:** ${rarity.name}\n` +
                `**Shiny:** ${isShiny ? 'Oui ✨' : 'Non'}\n` +
                `**QTE requis:** Non (Pokémon commun)\n\n` +
                `*Aucune capture enregistrée (mode test)*`
            )
            .setThumbnail(spriteUrl)
            .setColor(0x808080)
            .setFooter({ text: '🧪 MODE TEST - Utilise $catch pour capturer réellement' });
        
        await searchMsg.edit({ embeds: [embed] });
    }
}

/**
 * Catch command - Attempt to catch a random Pokemon
 */
export async function catchCommand(message) {
    await performCatch(message);
}

/**
 * Test legendary command - Force legendary spawn for testing QTE
 */
export async function testLegendaryCommand(message) {
    await performCatch(message, { forceMode: 'legendary', isTest: true });
}

/**
 * Handle QTE button interaction
 */
export async function handleQTEInteraction(interaction) {
    const qteId = interaction.customId;
    const qteData = activeQTEs.get(qteId);
    
    if (!qteData) {
        await interaction.reply({ content: '❌ Cette capture a expiré !', ephemeral: true });
        return true;
    }
    
    // Check if correct user
    if (interaction.user.id !== qteData.userId) {
        await interaction.reply({ content: '❌ Ce n\'est pas ton Pokémon !', ephemeral: true });
        return true;
    }
    
    // Remove from active QTEs
    activeQTEs.delete(qteId);
    
    const { pokemon, frenchName, isShiny, rarity, spriteUrl, description, isTest } = qteData;
    const reactionTime = Date.now() - qteData.startTime;
    
    // Success! Caught the Pokemon
    if (!isTest) {
        const catchResult = await db.addPokemonCatch(interaction.user.id, interaction.guild.id, {
            id: pokemon.id,
            name: pokemon.name,
            isShiny
        });
        const coinReward = getCatchCoinReward(rarity);
        const newBalance = await db.addMoney(interaction.user.id, interaction.guild.id, coinReward, 'pokemon_catch', `Capture: ${frenchName}`);
        
        const counts = await db.getPokemonCounts(interaction.user.id, interaction.guild.id);
        
        const successEmbed = new EmbedBuilder()
            .setTitle(`${isShiny ? '✨ SHINY ! ' : ''}${rarity.emoji} ${frenchName} capturé !`)
            .setDescription(
                `**Félicitations !** Tu as attrapé un **${rarity.name}** !\n\n` +
                `⚡ Temps de réaction: **${(reactionTime / 1000).toFixed(2)}s**\n\n` +
                `📊 **Infos:**\n` +
                `• Type: ${formatTypes(pokemon.types)}\n` +
                `• Rareté: ${rarity.name}\n` +
                `• N° Pokédex: #${pokemon.id}\n` +
                `💰 **+${coinReward.toLocaleString()} coins** (solde: ${newBalance.toLocaleString()})\n` +
                (description ? `\n📖 *${description}*` : '') +
                `\n\n${catchResult.isNewEntry ? '🆕 **Nouveau Pokémon ajouté au Pokédex !**' : ''}` +
                `${catchResult.isFirstShiny ? '\n⭐ **Premier shiny de cette espèce !**' : ''}`
            )
            .setThumbnail(spriteUrl)
            .setColor(isShiny ? 0xFFD700 : 0x00FF00)
            .setFooter({ text: `Pokédex: ${counts.unique}/898 • Total: ${counts.total} • Shinies: ${counts.shiny}` });
        
        if (isShiny) {
            successEmbed.setAuthor({ name: '✨ SHINY POKÉMON LÉGENDAIRE ! ✨' });
        }
        
        const disabledRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('caught')
                    .setLabel('✅ Capturé !')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
            );
        
        await interaction.update({ embeds: [successEmbed], components: [disabledRow] });
    } else {
        // Test mode
        const testEmbed = new EmbedBuilder()
            .setTitle(`🧪 TEST RÉUSSI: ${isShiny ? '✨ ' : ''}${rarity.emoji} ${frenchName}`)
            .setDescription(
                `**QTE réussi !**\n\n` +
                `⚡ Temps de réaction: **${(reactionTime / 1000).toFixed(2)}s**\n\n` +
                `**Pokémon:** ${frenchName}\n` +
                `**Type:** ${formatTypes(pokemon.types)}\n` +
                `**Rareté:** ${rarity.name}\n` +
                `**Shiny:** ${isShiny ? 'Oui ✨' : 'Non'}\n\n` +
                `*Aucune capture enregistrée (mode test)*`
            )
            .setThumbnail(spriteUrl)
            .setColor(0x00FF00)
            .setFooter({ text: '🧪 MODE TEST - Le système QTE fonctionne !' });
        
        const disabledRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('test_caught')
                    .setLabel('✅ Test réussi !')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
            );
        
        await interaction.update({ embeds: [testEmbed], components: [disabledRow] });
    }
    
    return true;
}

/**
 * Helper to draw rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Draw a simple Pokeball icon
 */
function drawPokeball(ctx, x, y, size) {
    const radius = size / 2;
    const centerX = x + radius;
    const centerY = y + radius;
    
    // Outer circle - red top
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 0);
    ctx.fillStyle = '#ff1a1a';
    ctx.fill();
    ctx.closePath();
    
    // Outer circle - white bottom
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.closePath();
    
    // Middle line
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, centerY - 1, size, 3);
    
    // Center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
    
    // Inner dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.closePath();
}

/**
 * Type colors for Pokemon types
 */
const TYPE_COLORS = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC'
};

/**
 * French type names
 */
const TYPE_NAMES_FR = {
    normal: 'Normal', fire: 'Feu', water: 'Eau', electric: 'Électrik',
    grass: 'Plante', ice: 'Glace', fighting: 'Combat', poison: 'Poison',
    ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte',
    rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres',
    steel: 'Acier', fairy: 'Fée'
};

/**
 * Generate Pokemon info card image (Modern Pokedex style)
 * @param {boolean} isShiny - If true, display shiny version
 * @param {object} userCaughtInfo - { caught: boolean, shinyCaught: boolean } or null
 */
async function generatePokemonInfoImage(pokemon, species, frenchName, description, rarity, isShiny = false, userCaughtInfo = null) {
    const width = 480;
    const height = 265;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // === MAIN BACKGROUND (Light blue gradient) ===
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#e8f4fc');
    bgGradient.addColorStop(1, '#c9e4f6');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // === LARGE POKEBALL BACKGROUND (Light red, decorative) ===
    const pokeballSize = 160;
    const pokeballCenterX = 90;
    const pokeballCenterY = 120;
    
    // === POKEBALL BACKGROUND ===
    const centerButtonRadius = 26;
    
    // Top half (light red) - using pre-mixed color instead of transparency
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.arc(pokeballCenterX, pokeballCenterY, pokeballSize/2, Math.PI, 0);
    ctx.fillStyle = '#f5c6c6'; // Light red pre-mixed with background
    ctx.fill();
    
    // Bottom half (very light) 
    ctx.beginPath();
    ctx.arc(pokeballCenterX, pokeballCenterY, pokeballSize/2, 0, Math.PI);
    ctx.fillStyle = '#e0eff7'; // Light white-blue pre-mixed with background
    ctx.fill();
    
    // Center line (split in two parts) - solid color
    ctx.fillStyle = '#a0c4d8';
    // Left part of line
    ctx.fillRect(pokeballCenterX - pokeballSize/2, pokeballCenterY - 3, pokeballSize/2 - centerButtonRadius, 6);
    // Right part of line
    ctx.fillRect(pokeballCenterX + centerButtonRadius, pokeballCenterY - 3, pokeballSize/2 - centerButtonRadius, 6);
    
    // Center button - outer ring (darker)
    ctx.beginPath();
    ctx.arc(pokeballCenterX, pokeballCenterY, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#a0c4d8';
    ctx.fill();
    
    // Center button - inner (white matching background tone)
    ctx.beginPath();
    ctx.arc(pokeballCenterX, pokeballCenterY, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#e8f4fc';
    ctx.fill();
    
    // === HEADER BAR ===
    const headerHeight = 45;
    ctx.fillStyle = '#3498db';
    ctx.fillRect(0, 0, width, headerHeight);
    
    // Header gradient overlay
    const headerGradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
    headerGradient.addColorStop(0, 'rgba(255,255,255,0.15)');
    headerGradient.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = headerGradient;
    ctx.fillRect(0, 0, width, headerHeight);
    
    // Pokemon number (large, left) - Using Pokemon font
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px "Pokemon", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`#${pokemon.id.toString().padStart(3, '0')}`, 12, 30);
    
    // Pokemon name (center) - Using Pokemon font
    ctx.font = '20px "Pokemon", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(frenchName, width / 2 + 40, 30);
    
    // Rarity indicator and caught status (right side)
    if (userCaughtInfo?.caught) {
        // Draw small Pokeball icon (top right)
        const pbX = width - 22;
        const pbY = 22;
        const pbSize = 16;
        
        // Pokeball top (red)
        ctx.beginPath();
        ctx.arc(pbX, pbY, pbSize/2, Math.PI, 0);
        ctx.fillStyle = '#ff4444';
        ctx.fill();
        
        // Pokeball bottom (white)
        ctx.beginPath();
        ctx.arc(pbX, pbY, pbSize/2, 0, Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // Pokeball line
        ctx.fillStyle = '#333333';
        ctx.fillRect(pbX - pbSize/2, pbY - 1, pbSize, 2);
        
        // Pokeball center
        ctx.beginPath();
        ctx.arc(pbX, pbY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Rarity text with Pokemon font (left of Pokeball)
        ctx.font = '14px "Pokemon", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = rarity.color === 0xFFD700 ? '#ffd700' : '#ffffff';
        ctx.fillText(rarity.name, pbX - 14, 27);
        
        // Shiny star if user caught shiny (on top right of Pokeball)
        if (userCaughtInfo.shinyCaught) {
            const starX = pbX + 6;
            const starY = 12;
            const starSize = 5;
            
            // Draw a 4-pointed star
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.moveTo(starX, starY - starSize);
            ctx.lineTo(starX + starSize * 0.3, starY - starSize * 0.3);
            ctx.lineTo(starX + starSize, starY);
            ctx.lineTo(starX + starSize * 0.3, starY + starSize * 0.3);
            ctx.lineTo(starX, starY + starSize);
            ctx.lineTo(starX - starSize * 0.3, starY + starSize * 0.3);
            ctx.lineTo(starX - starSize, starY);
            ctx.lineTo(starX - starSize * 0.3, starY - starSize * 0.3);
            ctx.closePath();
            ctx.fill();
        }
    } else {
        // Just show rarity without Pokeball
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = rarity.color === 0xFFD700 ? '#ffd700' : '#ffffff';
        ctx.fillText(rarity.name, width - 12, 28);
    }
    
    // === POKEMON SPRITE ===
    try {
        const spriteUrl = isShiny 
            ? (pokemon.sprites.other?.['official-artwork']?.front_shiny || pokemon.sprites.front_shiny)
            : (pokemon.sprites.other?.['official-artwork']?.front_default || pokemon.sprites.front_default);
        if (spriteUrl) {
            const sprite = await loadImage(spriteUrl);
            const spriteSize = 135;
            ctx.drawImage(sprite, 20, 52, spriteSize, spriteSize);
        }
    } catch (e) {
        console.error('Error loading Pokemon sprite:', e);
    }
    
    // Shiny indicator (draw star + text)
    if (isShiny) {
        const shinyX = 25;
        const shinyY = 192;
        
        // Draw a golden star
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        const starSize = 6;
        ctx.moveTo(shinyX, shinyY - starSize);
        ctx.lineTo(shinyX + starSize * 0.3, shinyY - starSize * 0.3);
        ctx.lineTo(shinyX + starSize, shinyY);
        ctx.lineTo(shinyX + starSize * 0.3, shinyY + starSize * 0.3);
        ctx.lineTo(shinyX, shinyY + starSize);
        ctx.lineTo(shinyX - starSize * 0.3, shinyY + starSize * 0.3);
        ctx.lineTo(shinyX - starSize, shinyY);
        ctx.lineTo(shinyX - starSize * 0.3, shinyY - starSize * 0.3);
        ctx.closePath();
        ctx.fill();
        
        // Text
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('SHINY', shinyX + 12, shinyY + 4);
    }
    
    // === INFO PANEL (Right side) ===
    const panelX = 170;
    const panelY = 50;
    const panelWidth = 298;
    const panelHeight = 140;
    
    // Panel background
    roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Species/Category
    const genus = species?.genera?.find(g => g.language.name === 'fr')?.genus 
        || species?.genera?.find(g => g.language.name === 'en')?.genus 
        || 'Pokemon';
    ctx.fillStyle = '#666666';
    ctx.font = 'italic 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(genus, panelX + 10, panelY + 16);
    
    // Type badges
    let typeX = panelX + 10;
    ctx.font = 'bold 10px sans-serif';
    for (const t of pokemon.types) {
        const typeName = t.type.name;
        const typeColor = TYPE_COLORS[typeName] || '#888888';
        const typeFr = TYPE_NAMES_FR[typeName] || typeName;
        
        const badgeWidth = ctx.measureText(typeFr.toUpperCase()).width + 16;
        roundRect(ctx, typeX, panelY + 22, badgeWidth, 18, 9);
        ctx.fillStyle = typeColor;
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(typeFr.toUpperCase(), typeX + 8, panelY + 35);
        
        typeX += badgeWidth + 6;
    }
    
    // Height & Weight row (text only, no emoji)
    ctx.fillStyle = '#444444';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Taille: ${(pokemon.height / 10).toFixed(1)} m`, panelX + 10, panelY + 56);
    ctx.fillText(`Poids: ${(pokemon.weight / 10).toFixed(1)} kg`, panelX + 100, panelY + 56);
    
    // === STATS SECTION ===
    const totalStats = pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0);
    
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`STATS (Total: ${totalStats})`, panelX + 10, panelY + 72);
    
    // Stat bars (compact 2x3 grid)
    const statNames = ['PV', 'ATQ', 'DEF', 'ATS', 'DFS', 'VIT'];
    const statColors = ['#ef5350', '#ff7043', '#ffca28', '#42a5f5', '#66bb6a', '#ec407a'];
    const statsStartY = panelY + 80;
    const colWidth = 145;
    const barWidth = 80;
    const barHeight = 7;
    
    for (let i = 0; i < 6; i++) {
        const stat = pokemon.stats[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = panelX + 10 + col * colWidth;
        const y = statsStartY + row * 18;
        const fillWidth = Math.min(barWidth, (stat.base_stat / 160) * barWidth);
        
        // Stat name
        ctx.fillStyle = '#555555';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(statNames[i], x, y + 6);
        
        // Bar background
        roundRect(ctx, x + 25, y, barWidth, barHeight, 3);
        ctx.fillStyle = '#e0e0e0';
        ctx.fill();
        
        // Bar fill
        if (fillWidth > 0) {
            roundRect(ctx, x + 25, y, fillWidth, barHeight, 3);
            ctx.fillStyle = statColors[i];
            ctx.fill();
        }
        
        // Value
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(stat.base_stat.toString(), x + barWidth + 30, y + 6);
    }
    
    // === DESCRIPTION SECTION (Bottom) ===
    const descY = 195;
    const descHeight = height - descY - 5;
    
    roundRect(ctx, 8, descY, width - 16, descHeight, 8);
    ctx.fillStyle = 'rgba(44, 62, 80, 0.92)';
    ctx.fill();
    
    // Description text (wrapped)
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    
    const descText = description || 'Aucune description disponible.';
    const maxWidth = width - 36;
    const words = descText.split(' ');
    let line = '';
    let lineY = descY + 16;
    const lineHeight = 14;
    const maxLines = 4;
    let lineCount = 0;
    
    for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line.trim(), 14, lineY);
            line = word + ' ';
            lineY += lineHeight;
            lineCount++;
            if (lineCount >= maxLines) break;
        } else {
            line = testLine;
        }
    }
    if (line && lineCount < maxLines) {
        ctx.fillText(line.trim(), 14, lineY);
    }
    
    // === OUTER BORDER ===
    roundRect(ctx, 2, 2, width - 4, height - 4, 6);
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    return canvas.toBuffer('image/png');
}

/**
 * Generate a grid-based Pokedex image for a filtered list of Pokemon IDs
 * Same style as the main Pokedex but for specific IDs (legendary, mythical, etc.)
 */
async function generateFilteredPokedexImage(pokemonIds, caughtMap, filterColor = '#5bc0de') {
    const cols = 5;
    const cellSize = 65;
    const spriteSize = 48;
    const cellPadding = 3;
    const padding = 8;
    const cornerRadius = 8;
    
    const totalPokemon = pokemonIds.length;
    const rows = Math.ceil(totalPokemon / cols);
    
    const width = cols * cellSize + padding * 2;
    const height = rows * cellSize + padding * 2;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Background color based on filter type
    ctx.fillStyle = filterColor;
    ctx.fillRect(0, 0, width, height);
    
    // Load sprites for caught Pokemon only (optimization)
    const spritePromises = pokemonIds.map(async (id) => {
        const caught = caughtMap.get(id);
        if (!caught) return { id, sprite: null, caught: false };
        
        try {
            const pokemon = await fetchPokemon(id);
            if (!pokemon) return { id, sprite: null, caught: true };
            
            // Shiny takes priority
            const spriteUrl = caught.shiny_caught 
                ? (pokemon.sprites.front_shiny || pokemon.sprites.front_default)
                : pokemon.sprites.front_default;
            
            if (!spriteUrl) return { id, sprite: null, caught: true, isShiny: caught.shiny_caught };
            
            const sprite = await loadImage(spriteUrl);
            return { id, sprite, caught: true, isShiny: caught.shiny_caught };
        } catch {
            return { id, sprite: null, caught: true };
        }
    });
    
    const spriteData = await Promise.all(spritePromises);
    const spriteMap = new Map(spriteData.map(s => [s.id, s]));
    
    // Draw grid cells
    for (let i = 0; i < totalPokemon; i++) {
        const pokemonId = pokemonIds[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * cellSize + cellPadding;
        const y = padding + row * cellSize + cellPadding;
        const innerSize = cellSize - cellPadding * 2;
        
        const data = spriteMap.get(pokemonId);
        const isCaught = data?.caught;
        const isShiny = data?.isShiny;
        
        // Cell border (darker version of filter color)
        roundRect(ctx, x, y, innerSize, innerSize, cornerRadius);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fill();
        
        // Cell inner background
        roundRect(ctx, x + 2, y + 2, innerSize - 4, innerSize - 4, cornerRadius - 2);
        if (isCaught) {
            // Caught - lighter
            ctx.fillStyle = isShiny ? '#fff8dc' : 'rgba(255, 255, 255, 0.5)';
        } else {
            // Not caught - slightly darker/faded
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        }
        ctx.fill();
        
        // Shiny sparkle border
        if (isShiny) {
            roundRect(ctx, x + 1, y + 1, innerSize - 2, innerSize - 2, cornerRadius - 1);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Draw Pokemon number (top right corner)
        ctx.fillStyle = isCaught ? '#333' : '#555';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(pokemonId.toString(), x + innerSize - 5, y + 14);
        
        // Draw sprite or silhouette placeholder
        if (data?.sprite) {
            const offsetX = (innerSize - spriteSize) / 2;
            const offsetY = (innerSize - spriteSize) / 2 + 2;
            ctx.drawImage(data.sprite, x + offsetX, y + offsetY, spriteSize, spriteSize);
            
            // Draw Pokeball icon (bottom left corner) for caught Pokemon
            drawPokeball(ctx, x + 4, y + innerSize - 16, 12);
        } else {
            // Show just the number larger in center for uncaught
            ctx.fillStyle = '#444';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(pokemonId.toString(), x + innerSize / 2, y + innerSize / 2 + 6);
        }
    }
    
    return canvas.toBuffer('image/png');
}

/**
 * Generate a grid-based Pokedex image with slots for each Pokemon
 * Shows sprites for caught Pokemon (shiny priority), empty slots for uncaught
 */
async function generatePokedexGridImage(startId, endId, caughtMap) {
    const cols = 5;
    const cellSize = 65;
    const spriteSize = 48;
    const cellPadding = 3;
    const padding = 8;
    const cornerRadius = 8;
    
    const totalPokemon = endId - startId + 1;
    const rows = Math.ceil(totalPokemon / cols);
    
    const width = cols * cellSize + padding * 2;
    const height = rows * cellSize + padding * 2;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Light blue background (like the reference image)
    ctx.fillStyle = '#5bc0de';
    ctx.fillRect(0, 0, width, height);
    
    // Fetch all Pokemon data for this range
    const pokemonIds = [];
    for (let id = startId; id <= endId; id++) {
        pokemonIds.push(id);
    }
    
    // Load sprites for caught Pokemon only (optimization)
    const spritePromises = pokemonIds.map(async (id) => {
        const caught = caughtMap.get(id);
        if (!caught) return { id, sprite: null, caught: false };
        
        try {
            const pokemon = await fetchPokemon(id);
            if (!pokemon) return { id, sprite: null, caught: true };
            
            // Shiny takes priority
            const spriteUrl = caught.shiny_caught 
                ? (pokemon.sprites.front_shiny || pokemon.sprites.front_default)
                : pokemon.sprites.front_default;
            
            if (!spriteUrl) return { id, sprite: null, caught: true, isShiny: caught.shiny_caught };
            
            const sprite = await loadImage(spriteUrl);
            return { id, sprite, caught: true, isShiny: caught.shiny_caught };
        } catch {
            return { id, sprite: null, caught: true };
        }
    });
    
    const spriteData = await Promise.all(spritePromises);
    const spriteMap = new Map(spriteData.map(s => [s.id, s]));
    
    // Draw grid cells
    for (let i = 0; i < totalPokemon; i++) {
        const pokemonId = startId + i;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * cellSize + cellPadding;
        const y = padding + row * cellSize + cellPadding;
        const innerSize = cellSize - cellPadding * 2;
        
        const data = spriteMap.get(pokemonId);
        const isCaught = data?.caught;
        const isShiny = data?.isShiny;
        
        // Cell border (darker blue)
        roundRect(ctx, x, y, innerSize, innerSize, cornerRadius);
        ctx.fillStyle = '#3a9fc9';
        ctx.fill();
        
        // Cell inner background
        roundRect(ctx, x + 2, y + 2, innerSize - 4, innerSize - 4, cornerRadius - 2);
        if (isCaught) {
            // Caught - lighter blue/cyan
            ctx.fillStyle = isShiny ? '#fff8dc' : '#7dd3e8';
        } else {
            // Not caught - slightly darker/faded
            ctx.fillStyle = '#4aa8cc';
        }
        ctx.fill();
        
        // Shiny sparkle border
        if (isShiny) {
            roundRect(ctx, x + 1, y + 1, innerSize - 2, innerSize - 2, cornerRadius - 1);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Draw Pokemon number (top right corner)
        ctx.fillStyle = isCaught ? '#2980b9' : '#357a9e';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(pokemonId.toString(), x + innerSize - 5, y + 14);
        
        // Draw sprite or silhouette placeholder
        if (data?.sprite) {
            const offsetX = (innerSize - spriteSize) / 2;
            const offsetY = (innerSize - spriteSize) / 2 + 2;
            ctx.drawImage(data.sprite, x + offsetX, y + offsetY, spriteSize, spriteSize);
            
            // Draw Pokeball icon (bottom left corner) for caught Pokemon
            drawPokeball(ctx, x + 4, y + innerSize - 16, 12);
        } else {
            // Show just the number larger in center for uncaught
            ctx.fillStyle = '#357a9e';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(pokemonId.toString(), x + innerSize / 2, y + innerSize / 2 + 6);
        }
    }
    
    return canvas.toBuffer('image/png');
}

/**
 * Create navigation buttons for Pokedex pagination
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @param {string} prefix - Button ID prefix (e.g., 'dex' or 'dex_legendary')
 * @param {string} userId - User ID to restrict button usage
 */
function createPokedexNavButtons(currentPage, totalPages, prefix, userId) {
    const row = new ActionRowBuilder();
    
    // First button (only if > 2 pages)
    if (totalPages > 2) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${prefix}_first_${userId}`)
                .setLabel('⏮️ Début')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1)
        );
    }
    
    // Previous button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefix}_prev_${userId}`)
            .setLabel('◀️ Préc.')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 1)
    );
    
    // Page indicator (disabled button)
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefix}_page_${userId}`)
            .setLabel(`${currentPage}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );
    
    // Next button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefix}_next_${userId}`)
            .setLabel('Suiv. ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages)
    );
    
    // End button (only if > 2 pages)
    if (totalPages > 2) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${prefix}_last_${userId}`)
                .setLabel('Fin ⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages)
        );
    }
    
    return row;
}

/**
 * Get Pokemon IDs for a given filter category
 * Uses the categories cache for accurate data
 */
function getFilteredPokemonIds(filter) {
    const f = filter?.toLowerCase();
    switch (f) {
        case 'legendary':
        case 'legendaire':
        case 'légendaire':
        case 'leg':
            return { ids: [...getCategoryIds('legendary')].sort((a, b) => a - b), name: 'Légendaires', emoji: '🌟', color: 0xFFD700, bgColor: '#d4a017' };
        case 'mythical':
        case 'mythique':
        case 'fabuleux':
        case 'fab':
            return { ids: [...getCategoryIds('mythical')].sort((a, b) => a - b), name: 'Fabuleux', emoji: '✨', color: 0xFF00FF, bgColor: '#c850c0' };
        case 'pseudo':
        case 'pseudo-legendary':
        case 'pseudo-légendaire':
            return { ids: [...getCategoryIds('pseudo')].sort((a, b) => a - b), name: 'Pseudo-Légendaires', emoji: '💎', color: 0x9B59B6, bgColor: '#8e44ad' };
        case 'starter':
        case 'starters':
        case 'départ':
            return { ids: [...getCategoryIds('starter')].sort((a, b) => a - b), name: 'Starters', emoji: '🔥', color: 0xE67E22, bgColor: '#e67e22' };
        case 'shiny':
        case 'shinies':
            return { ids: null, name: 'Shinies', emoji: '✨', color: 0xFFD700, bgColor: '#f1c40f', special: 'shiny' };
        default:
            return null;
    }
}

/**
 * Pokedex command - View caught Pokemon progress in grid format
 * Supports filters: legendary, mythical, starter, pseudo, shiny
 */
export async function pokedexCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const pokedex = await db.getPokedex(userId, guildId);
    const counts = await db.getPokemonCounts(userId, guildId);
    
    // Create a map of caught Pokemon for quick lookup
    const caughtMap = new Map();
    for (const entry of pokedex) {
        caughtMap.set(entry.pokemon_id, entry);
    }
    
    // Check if first argument is a filter
    const filterData = getFilteredPokemonIds(args[0]);
    
    if (filterData) {
        // ========== FILTERED GRID MODE ==========
        let filteredIds = filterData.ids;
        
        // Special handling for shiny filter (show only caught shinies)
        if (filterData.special === 'shiny') {
            filteredIds = [...caughtMap.entries()]
                .filter(([id, entry]) => entry.shiny_caught)
                .map(([id]) => id)
                .sort((a, b) => a - b);
        }
        
        if (!filteredIds || filteredIds.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${filterData.emoji} Pokédex - ${filterData.name}`)
                .setDescription(filterData.special === 'shiny' 
                    ? 'Tu n\'as pas encore attrapé de shiny !' 
                    : 'Aucun Pokémon dans cette catégorie.')
                .setColor(filterData.color);
            return message.reply({ embeds: [embed] });
        }
        
        // Pagination for filtered list (35 per page = 5x7 grid, same as main pokedex)
        const perPage = 35;
        const totalPages = Math.ceil(filteredIds.length / perPage);
        const page = Math.max(1, Math.min(parseInt(args[1]) || 1, totalPages));
        const startIdx = (page - 1) * perPage;
        const pageIds = filteredIds.slice(startIdx, startIdx + perPage);
        
        // Count caught in this category
        let caughtCount = 0;
        let shinyCount = 0;
        for (const id of filteredIds) {
            const entry = caughtMap.get(id);
            if (entry) {
                caughtCount++;
                if (entry.shiny_caught) shinyCount++;
            }
        }
        
        // Show loading message
        const loadingEmbed = new EmbedBuilder()
            .setDescription(`🔍 Génération du Pokédex ${filterData.name}...`)
            .setColor(filterData.color);
        const loadingMsg = await message.reply({ embeds: [loadingEmbed] });
        
        try {
            // Generate the filtered grid image
            const imageBuffer = await generateFilteredPokedexImage(pageIds, caughtMap, filterData.bgColor);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'pokedex-filtered.png' });
            
            const completionPercent = ((caughtCount / filteredIds.length) * 100).toFixed(1);
            
            const embed = new EmbedBuilder()
                .setTitle(`${filterData.emoji} Pokédex - ${filterData.name}`)
                .setDescription(`**${caughtCount}/${filteredIds.length}** capturés (${completionPercent}%)${shinyCount > 0 ? ` • ${shinyCount} ✨` : ''}`)
                .setColor(filterData.color)
                .setImage('attachment://pokedex-filtered.png')
                .setFooter({ text: `Page ${page}/${totalPages}` });
            
            // Add navigation buttons if more than 1 page
            const components = [];
            if (totalPages > 1) {
                const navRow = createPokedexNavButtons(page, totalPages, `dex_${args[0].toLowerCase()}`, userId);
                components.push(navRow);
            }
            
            await loadingMsg.edit({ embeds: [embed], files: [attachment], components });
        } catch (error) {
            console.error('Error generating filtered pokedex image:', error);
            
            // Fallback to text list
            const lines = await Promise.all(pageIds.map(async (id) => {
                const entry = caughtMap.get(id);
                const caught = !!entry;
                const shiny = entry?.shiny_caught ? ' ✨' : '';
                const species = await fetchSpecies(id);
                const frenchName = getFrenchName(species, species?.name || `Pokemon ${id}`);
                const status = caught ? '✅' : '❌';
                return `${status} **#${id.toString().padStart(3, '0')}** ${frenchName}${shiny}`;
            }));
            
            const embed = new EmbedBuilder()
                .setTitle(`${filterData.emoji} Pokédex - ${filterData.name}`)
                .setDescription(lines.join('\n'))
                .setColor(filterData.color)
                .addFields(
                    { name: '📊 Progression', value: `${caughtCount}/${filteredIds.length}`, inline: true },
                    { name: '✨ Shinies', value: `${shinyCount}`, inline: true }
                )
                .setFooter({ text: `Page ${page}/${totalPages}` });
            
            // Add navigation buttons if more than 1 page
            const fallbackComponents = [];
            if (totalPages > 1) {
                const navRow = createPokedexNavButtons(page, totalPages, `dex_${args[0].toLowerCase()}`, userId);
                fallbackComponents.push(navRow);
            }
            
            await loadingMsg.edit({ embeds: [embed], components: fallbackComponents });
        }
        return;
    }
    
    // ========== GRID MODE (default) ==========
    // Pagination by Pokemon ID ranges (35 per page = 5x7 grid)
    const perPage = 35;
    const totalPages = Math.ceil(MAX_POKEMON_ID / perPage);
    const page = Math.max(1, Math.min(parseInt(args[0]) || 1, totalPages));
    
    const startId = (page - 1) * perPage + 1;
    const endId = Math.min(page * perPage, MAX_POKEMON_ID);
    
    // Count caught in this range
    let caughtInRange = 0;
    let shinyInRange = 0;
    for (let id = startId; id <= endId; id++) {
        const entry = caughtMap.get(id);
        if (entry) {
            caughtInRange++;
            if (entry.shiny_caught) shinyInRange++;
        }
    }
    
    // Show loading message
    const loadingEmbed = new EmbedBuilder()
        .setDescription('🔍 Génération du Pokédex...')
        .setColor(0x3498db);
    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });
    
    try {
        // Generate the grid image
        const imageBuffer = await generatePokedexGridImage(startId, endId, caughtMap);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'pokedex.png' });
        
        const completionPercent = ((counts.unique / MAX_POKEMON_ID) * 100).toFixed(1);
        
        const embed = new EmbedBuilder()
            .setTitle(`📕 Pokédex de ${message.author.username}`)
            .setDescription(
                `**#${startId.toString().padStart(3, '0')}** à **#${endId.toString().padStart(3, '0')}** — ${caughtInRange}/${endId - startId + 1} capturés${shinyInRange > 0 ? ` (${shinyInRange} ✨)` : ''}\n\n` +
                `**Filtres :** \`$dex legendary\` • \`$dex mythical\` • \`$dex starter\` • \`$dex pseudo\` • \`$dex shiny\``
            )
            .setColor(0xE74C3C)
            .setImage('attachment://pokedex.png')
            .addFields(
                { name: '📊 Total', value: `${counts.unique}/${MAX_POKEMON_ID} (${completionPercent}%)`, inline: true },
                { name: '🎯 Attrapés', value: `${counts.total}`, inline: true },
                { name: '✨ Shinies', value: `${counts.shiny}`, inline: true }
            )
            .setFooter({ text: `Page ${page}/${totalPages}` });
        
        // Add navigation buttons
        const navRow = createPokedexNavButtons(page, totalPages, 'dex_main', userId);
        
        await loadingMsg.edit({ embeds: [embed], files: [attachment], components: [navRow] });
    } catch (error) {
        console.error('Error generating pokedex image:', error);
        
        // Fallback to text
        const embed = new EmbedBuilder()
            .setTitle(`📕 Pokédex de ${message.author.username}`)
            .setDescription(`Erreur lors de la génération de l'image.\n\n**Progression:** ${counts.unique}/${MAX_POKEMON_ID} Pokémon capturés`)
            .setColor(0xE74C3C);
        
        // Add navigation buttons even in fallback
        const navRow = createPokedexNavButtons(page, totalPages, 'dex_main', userId);
        
        await loadingMsg.edit({ embeds: [embed], components: [navRow] });
    }
}

/**
 * Pokemon info command - Get details about a specific Pokemon
 */
export async function pokemonInfoCommand(message, args) {
    if (!args || args.length === 0) {
        return message.reply('❌ Utilisation: `$pokemon <nom ou numéro>`\nExemple: `$pokemon pikachu` ou `$pokemon 25` ou `$pokemon dracaufeu`');
    }
    
    const query = args.join(' ').toLowerCase();
    
    // Show loading
    const loadingEmbed = new EmbedBuilder()
        .setDescription('🔍 Recherche du Pokémon...')
        .setColor(0x3498db);
    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });
    
    const pokemon = await findPokemon(query);
    
    if (!pokemon) {
        const errorEmbed = new EmbedBuilder()
            .setDescription(`❌ Pokémon "${query}" non trouvé !\n\n*Essaie avec le nom anglais ou le numéro du Pokédex.*`)
            .setColor(0xff0000);
        return loadingMsg.edit({ embeds: [errorEmbed] });
    }
    
    const species = await fetchSpecies(pokemon.id);
    const description = getFrenchDescription(species);
    const frenchName = getFrenchName(species, pokemon.name);
    const rarity = getRarity(pokemon.id, species);
    
    // Check if user has caught this Pokemon
    const userId = message.author.id;
    const guildId = message.guild.id;
    const pokedex = await db.getPokedex(userId, guildId);
    const caughtEntry = pokedex.find(p => p.pokemon_id === pokemon.id);
    const userCaughtInfo = caughtEntry ? { caught: true, shinyCaught: caughtEntry.shiny_caught } : null;
    
    try {
        // Generate the Pokemon info card image
        const imageBuffer = await generatePokemonInfoImage(pokemon, species, frenchName, description, rarity, false, userCaughtInfo);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'pokemon-info.png' });
        
        const generation = species?.generation?.name?.split('-')[1]?.toUpperCase() || '?';
        
        const embed = new EmbedBuilder()
            .setColor(rarity.color)
            .setImage('attachment://pokemon-info.png')
            .setFooter({ text: `Génération ${generation} • Utilise $catch pour capturer des Pokémon !` });
        
        // Add shiny button
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`pokemon_shiny_${pokemon.id}`)
                    .setLabel('✨ Voir Shiny')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await loadingMsg.edit({ embeds: [embed], files: [attachment], components: [row] });
    } catch (error) {
        console.error('Error generating Pokemon info image:', error);
        
        // Fallback to embed-based display
        const stats = pokemon.stats.map(s => {
            const statNames = {
                'hp': 'PV ', 'attack': 'ATK', 'defense': 'DEF',
                'special-attack': 'SPA', 'special-defense': 'SPD', 'speed': 'VIT'
            };
            const name = statNames[s.stat.name] || s.stat.name;
            const value = s.base_stat;
            const filled = Math.min(5, Math.round(value / 40));
            let color;
            if (value >= 100) color = '🟩';
            else if (value >= 70) color = '🟨';
            else if (value >= 40) color = '🟧';
            else color = '🟥';
            const bar = color.repeat(filled) + '⬜'.repeat(5 - filled);
            return `\`${name}\` ${bar} \`${value.toString().padStart(3)}\``;
        }).join('\n');
        
        const totalStats = pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0);
        
        const embed = new EmbedBuilder()
            .setTitle(`#${pokemon.id} ${frenchName} ${rarity.emoji}`)
            .setDescription(description || '*Aucune description disponible*')
            .setThumbnail(pokemon.sprites.front_default)
            .setImage(pokemon.sprites.other['official-artwork']?.front_default || pokemon.sprites.front_default)
            .setColor(rarity.color)
            .addFields(
                { name: '🏷️ Type', value: formatTypes(pokemon.types), inline: true },
                { name: '📏 Taille', value: `${pokemon.height / 10}m`, inline: true },
                { name: '⚖️ Poids', value: `${pokemon.weight / 10}kg`, inline: true },
                { name: '⭐ Rareté', value: rarity.name, inline: true },
                { name: `📊 Stats (Total: ${totalStats})`, value: stats, inline: false }
            )
            .setFooter({ text: `Génération ${species?.generation?.name?.split('-')[1]?.toUpperCase() || '?'} • Utilise $catch pour capturer des Pokémon !` });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`pokemon_shiny_${pokemon.id}`)
                    .setLabel('✨ Voir Shiny')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await loadingMsg.edit({ embeds: [embed], components: [row] });
    }
}

/**
 * Convert mega stone id to PokeAPI form name (e.g. charizardite-x -> charizard-mega-x)
 */
function stoneIdToMegaFormName(stoneId) {
    const special = { 'mewtwonite-x': 'mewtwo-mega-x', 'mewtwonite-y': 'mewtwo-mega-y' };
    if (special[stoneId]) return special[stoneId];
    const match = stoneId.match(/^(.+?)ite(-[a-z0-9]+)?$/i);
    if (!match) return null;
    const base = match[1];
    const suffix = match[2] || '';
    return base + '-mega' + suffix;
}

/**
 * Evolve command - Evolve a Pokemon by Pokedex ID
 * Usage: $evolve <n° Pokédex> [target] or $evolve <n°> mega [pierre]
 * If multiple evolutions are possible, user must specify target (name or ID)
 */
export async function evolveCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const pokemonIdArg = parseInt(args[0], 10);
    if (isNaN(pokemonIdArg) || pokemonIdArg < 1 || pokemonIdArg > MAX_POKEMON_ID) {
        await message.reply(`❌ Utilisation : \`$evolve <n° Pokédex>\` (ex: $evolve 1 pour évoluer un Bulbizarre)\n` +
            `Si plusieurs évolutions possibles : \`$evolve <n°> <cible>\` (ex: $evolve 281 gardevoir)\n` +
            `Pour méga-évolution : \`$evolve <n°> mega [pierre]\``);
        return;
    }
    
    const catches = await db.getPokemonCatchesByPokemonId(userId, guildId, pokemonIdArg, 1);
    if (catches.length === 0) {
        await message.reply(`❌ Tu ne possèdes pas le Pokémon #${pokemonIdArg} du Pokédex. Utilise \`$pc\` pour voir ta boîte.`);
        return;
    }
    
    const catchRow = catches[0];
    const pokemonId = catchRow.pokemon_id;
    const evolutionStage = catchRow.evolution_stage ?? 1;
    const isMega = !!catchRow.is_mega;
    
    if (isMega) {
        await message.reply('❌ Ce Pokémon est déjà en forme Méga.');
        return;
    }
    
    const species = await fetchSpecies(pokemonId);
    if (!species) {
        await message.reply('❌ Impossible de charger les données d\'évolution.');
        return;
    }
    
    const currentFrenchName = getFrenchName(species, catchRow.pokemon_name);
    const evoInfo = await getEvolutionInfo(pokemonId, species);
    const isSpecial = isSpecialPokemon(pokemonId);
    const costs = isSpecial ? EVOLVE_COST.special : EVOLVE_COST.normal;
    const balance = await db.getBalance(userId, guildId);
    
    const wantMega = args[1]?.toLowerCase() === 'mega';
    
    // ========== MEGA EVOLUTION ==========
    if (wantMega) {
        if (!evoInfo.canMega) {
            await message.reply('❌ Ce Pokémon ne peut pas faire de Méga-évolution (ou n\'est pas au stade final).');
            return;
        }
        const stonesForSpecies = evoInfo.megaStones;
        const stoneArg = args[2]?.toLowerCase();
        
        // If multiple mega stones and none specified, show options
        if (!stoneArg && stonesForSpecies.length > 1) {
            const list = await Promise.all(stonesForSpecies.map(async s => {
                const formName = stoneIdToMegaFormName(s.stoneId);
                return `• \`${s.stoneId}\` → **${s.frenchName}** (${formName?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || '?'})`;
            }));
            const embed = new EmbedBuilder()
                .setTitle(`🔮 Méga-évolutions possibles pour ${currentFrenchName}`)
                .setDescription(
                    `Ce Pokémon a **${stonesForSpecies.length} formes Méga** possibles !\n\n` +
                    list.join('\n') +
                    `\n\n**Utilisation :** \`$evolve ${pokemonIdArg} mega <pierre>\`\n` +
                    `*(Tu dois d'abord acheter la pierre dans \`$megashop\`)*`
                )
                .setColor(0x9B59B6)
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }
        
        const stone = stoneArg
            ? stonesForSpecies.find(s => s.stoneId === stoneArg)
            : stonesForSpecies.length === 1 ? stonesForSpecies[0] : null;
        
        if (!stone) {
            const list = stonesForSpecies.map(s => `\`${s.stoneId}\` (${s.frenchName})`).join(', ');
            await message.reply(`❌ Pierre Méga invalide. Pierres disponibles : ${list}`);
            return;
        }
        
        const userStones = await db.getMegaStones(userId, guildId);
        if ((userStones[stone.stoneId] || 0) < 1) {
            await message.reply(`❌ Tu n'as pas la pierre **${stone.frenchName}** (\`${stone.stoneId}\`). Achète-la avec \`$megashop\`.`);
            return;
        }
        const cost = costs.mega;
        if (balance < cost) {
            await message.reply(`❌ Il te faut **${cost.toLocaleString()}** coins pour la Méga-évolution. Tu as **${balance.toLocaleString()}** coins.`);
            return;
        }
        const formName = stoneIdToMegaFormName(stone.stoneId);
        if (!formName) {
            await message.reply('❌ Erreur : forme Méga inconnue.');
            return;
        }
        await db.removeMoney(userId, guildId, cost, 'pokemon_evolve', `Méga-évolution: ${catchRow.pokemon_name}`);
        await db.useMegaStone(userId, guildId, stone.stoneId);
        await db.updatePokemonEvolution(userId, guildId, catchRow.id, {
            pokemonId,
            pokemonName: catchRow.pokemon_name,
            evolutionStage,
            isMega: true,
            megaForm: formName
        });
        const megaPokemon = await fetchPokemon(formName);
        const megaFrenchName = formName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const embed = new EmbedBuilder()
            .setTitle(`✨ Méga-évolution !`)
            .setDescription(`**${currentFrenchName}** est devenu **${megaFrenchName}** !\n\n💰 Coût : **${cost.toLocaleString()}** coins + pierre **${stone.frenchName}**`)
            .setThumbnail(megaPokemon?.sprites?.other?.['official-artwork']?.front_default || megaPokemon?.sprites?.front_default || null)
            .setColor(0x9B59B6)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // ========== NORMAL EVOLUTION ==========
    if (evoInfo.isFinal || evoInfo.nextEvolutions.length === 0) {
        const megaHint = evoInfo.canMega
            ? `\nTu peux faire une **Méga-évolution** avec \`$evolve ${pokemonIdArg} mega\` (après avoir acheté la pierre dans \`$megashop\`).`
            : '';
        await message.reply('❌ Ce Pokémon est déjà au stade final et ne peut pas évoluer normalement.' + megaHint);
        return;
    }
    
    const targetArg = args[1]?.toLowerCase();
    let targetId = null;
    
    // Multiple evolution options?
    if (evoInfo.nextEvolutions.length > 1) {
        // Fetch species data for all options to show French names
        const optionsData = await Promise.all(evoInfo.nextEvolutions.map(async id => {
            const sp = await fetchSpecies(id);
            return { id, species: sp, frenchName: getFrenchName(sp, sp?.name || String(id)), englishName: sp?.name || String(id) };
        }));
        
        if (!targetArg) {
            // Show available options
            const list = optionsData.map(o => `• **${o.frenchName}** (#${o.id}) → \`$evolve ${pokemonIdArg} ${o.id}\` ou \`$evolve ${pokemonIdArg} ${o.englishName}\``);
            const embed = new EmbedBuilder()
                .setTitle(`🔀 Évolutions possibles pour ${currentFrenchName}`)
                .setDescription(
                    `Ce Pokémon peut évoluer en **${optionsData.length} formes différentes** !\n\n` +
                    list.join('\n') +
                    `\n\n**Utilisation :** \`$evolve ${pokemonIdArg} <cible>\`\n` +
                    `(Spécifie le n° Pokédex ou le nom anglais de l'évolution souhaitée)`
                )
                .setColor(0x3498DB)
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }
        
        // User specified a target - find it
        const targetNum = parseInt(targetArg, 10);
        const found = optionsData.find(o => 
            o.id === targetNum || 
            o.englishName?.toLowerCase() === targetArg ||
            o.frenchName?.toLowerCase() === targetArg
        );
        
        if (!found) {
            const list = optionsData.map(o => `\`${o.id}\` (${o.frenchName})`).join(', ');
            await message.reply(`❌ Évolution invalide. Options disponibles : ${list}`);
            return;
        }
        
        targetId = found.id;
    } else {
        // Single evolution path
        targetId = evoInfo.nextEvolutions[0];
    }
    
    const cost = evolutionStage === 1 ? costs.toSecond : costs.toThird;
    if (balance < cost) {
        await message.reply(`❌ Il te faut **${cost.toLocaleString()}** coins pour cette évolution. Tu as **${balance.toLocaleString()}** coins.`);
        return;
    }
    
    const nextSpecies = await fetchSpecies(targetId);
    const nextName = nextSpecies?.name || String(targetId);
    await db.removeMoney(userId, guildId, cost, 'pokemon_evolve', `Évolution: ${catchRow.pokemon_name} -> ${nextName}`);
    await db.updatePokemonEvolution(userId, guildId, catchRow.id, {
        pokemonId: targetId,
        pokemonName: nextName,
        evolutionStage: evoInfo.stage + 1,
        isMega: false,
        megaForm: null
    });
    const frenchNameNext = getFrenchName(nextSpecies, nextName);
    const embed = new EmbedBuilder()
        .setTitle('⬆️ Évolution réussie !')
        .setDescription(`**${currentFrenchName}** a évolué en **${frenchNameNext}** !\n\n💰 Coût : **${cost.toLocaleString()}** coins`)
        .setColor(0x2ECC71)
        .setTimestamp();
    await message.reply({ embeds: [embed] });
}

/**
 * Mega stone shop - List and buy mega stones
 */
export async function megashopCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const balance = await db.getBalance(userId, guildId);
    
    if (args[0]?.toLowerCase() === 'buy' || args[0]?.toLowerCase() === 'acheter') {
        const stoneId = args[1]?.toLowerCase();
        if (!stoneId) {
            await message.reply('❌ Utilisation : `$megashop buy <id_pierre>` (ex: $megashop buy charizardite-x)');
            return;
        }
        const stone = MEGA_STONES.find(s => s.stoneId === stoneId);
        if (!stone) {
            await message.reply('❌ Pierre inconnue. Utilise `$megashop` pour voir la liste.');
            return;
        }
        const price = MEGA_STONE_PRICES[stone.priceTier] ?? 5000;
        if (balance < price) {
            await message.reply(`❌ Tu n'as pas assez de coins. **${stone.frenchName}** coûte **${price.toLocaleString()}** coins. Tu as **${balance.toLocaleString()}** coins.`);
            return;
        }
        await db.removeMoney(userId, guildId, price, 'megashop', `Achat: ${stone.frenchName}`);
        await db.addMegaStone(userId, guildId, stoneId, 1);
        const newBalance = await db.getBalance(userId, guildId);
        const embed = new EmbedBuilder()
            .setTitle('🛒 Achat réussi')
            .setDescription(`Tu as acheté **${stone.frenchName}** (\`${stone.stoneId}\`) pour **${price.toLocaleString()}** coins.\n\n💰 Solde : **${newBalance.toLocaleString()}** coins`)
            .setColor(0x2ECC71)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // List shop
    const lines = MEGA_STONES.map(s => {
        const price = MEGA_STONE_PRICES[s.priceTier] ?? 5000;
        return `• **${s.frenchName}** \`${s.stoneId}\` — **${price.toLocaleString()}** coins`;
    });
    const embed = new EmbedBuilder()
        .setTitle('💎 Boutique Pierres Méga')
        .setDescription(
            `Achète des pierres Méga pour faire évoluer tes Pokémon en forme Méga.\n\n` +
            `**Achat :** \`$megashop buy <id_pierre>\`\n\n` +
            `**Liste des pierres :**\n${lines.slice(0, 25).join('\n')}` +
            (lines.length > 25 ? `\n... et ${lines.length - 25} autres.` : '') +
            `\n\n💰 Ton solde : **${balance.toLocaleString()}** coins`
        )
        .setColor(0x9B59B6)
        .setFooter({ text: 'Évolution : $evolve <n° Pokédex> • Méga : $evolve <n°> mega <pierre>' })
        .setTimestamp();
    await message.reply({ embeds: [embed] });
}

/**
 * PC/Box command - View all caught Pokemon
 */
export async function pcCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const page = parseInt(args[0]) || 1;
    const perPage = 10;
    const offset = (page - 1) * perPage;
    
    const catches = await db.getPokemonCollection(userId, guildId, perPage, offset);
    const counts = await db.getPokemonCounts(userId, guildId);
    
    if (catches.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('📦 PC - Boîte Pokémon')
            .setDescription('Ta boîte est vide ! Utilise `$catch` pour capturer des Pokémon.')
            .setColor(0x3498db);
        return message.reply({ embeds: [embed] });
    }
    
    // Show loading message
    const loadingEmbed = new EmbedBuilder()
        .setDescription('🔍 Chargement du PC...')
        .setColor(0x3498db);
    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });
    
    const totalPages = Math.ceil(counts.total / perPage);
    
    // Fetch French names for all Pokemon on this page
    const speciesData = await Promise.all(
        catches.map(p => fetchSpecies(p.pokemon_id))
    );
    
    const pokemonList = catches.map((p, i) => {
        const shiny = p.is_shiny ? ' ✨' : '';
        const mega = p.is_mega ? ' Méga' : '';
        const date = new Date(p.caught_at).toLocaleDateString('fr-FR');
        const frenchName = getFrenchName(speciesData[i], p.pokemon_name);
        return `**${offset + i + 1}.** #${p.pokemon_id} ${frenchName}${mega}${shiny} • *${date}*`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle(`📦 PC de ${message.author.username}`)
        .setDescription(pokemonList)
        .setColor(0x3498db)
        .addFields(
            { name: '📊 Total', value: `${counts.total} Pokémon`, inline: true },
            { name: '✨ Shinies', value: `${counts.shiny}`, inline: true }
        )
        .setFooter({ text: `Page ${page}/${totalPages} • $pc <page> | Évolution: $evolve <n° Pokédex> | Méga: $megashop` });
    
    await loadingMsg.edit({ embeds: [embed] });
}

/**
 * Handle Pokedex navigation button interaction
 */
export async function handlePokedexNavigation(interaction) {
    const customId = interaction.customId;
    
    // Check if this is a pokedex navigation button
    if (!customId.startsWith('dex_')) return false;
    
    // Parse button ID: dex_<filter>_<action>_<userId>
    // Examples: dex_main_next_123456, dex_legendary_prev_123456
    const parts = customId.split('_');
    if (parts.length < 4) return false;
    
    const filterType = parts[1]; // 'main', 'legendary', 'mythical', etc.
    const action = parts[2]; // 'first', 'prev', 'next', 'last', 'page'
    const ownerId = parts[3];
    
    // Check if it's a page indicator (disabled button)
    if (action === 'page') return true;
    
    // Check if the user clicking is the owner
    if (interaction.user.id !== ownerId) {
        await interaction.reply({ content: '❌ Ce n\'est pas ton Pokédex !', ephemeral: true });
        return true;
    }
    
    await interaction.deferUpdate();
    
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    
    // Get current page from footer
    const currentEmbed = interaction.message.embeds[0];
    const footerText = currentEmbed?.footer?.text || '';
    const pageMatch = footerText.match(/Page (\d+)\/(\d+)/);
    
    if (!pageMatch) {
        await interaction.followUp({ content: '❌ Erreur de pagination.', ephemeral: true });
        return true;
    }
    
    let currentPage = parseInt(pageMatch[1], 10);
    const totalPages = parseInt(pageMatch[2], 10);
    
    // Calculate new page based on action
    let newPage = currentPage;
    switch (action) {
        case 'first': newPage = 1; break;
        case 'prev': newPage = Math.max(1, currentPage - 1); break;
        case 'next': newPage = Math.min(totalPages, currentPage + 1); break;
        case 'last': newPage = totalPages; break;
    }
    
    if (newPage === currentPage) return true;
    
    // Regenerate the pokedex for the new page
    const pokedex = await db.getPokedex(userId, guildId);
    const counts = await db.getPokemonCounts(userId, guildId);
    
    const caughtMap = new Map();
    for (const entry of pokedex) {
        caughtMap.set(entry.pokemon_id, entry);
    }
    
    try {
        if (filterType === 'main') {
            // Main Pokedex grid
            const perPage = 35;
            const startId = (newPage - 1) * perPage + 1;
            const endId = Math.min(newPage * perPage, MAX_POKEMON_ID);
            
            let caughtInRange = 0;
            let shinyInRange = 0;
            for (let id = startId; id <= endId; id++) {
                const entry = caughtMap.get(id);
                if (entry) {
                    caughtInRange++;
                    if (entry.shiny_caught) shinyInRange++;
                }
            }
            
            const imageBuffer = await generatePokedexGridImage(startId, endId, caughtMap);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'pokedex.png' });
            
            const completionPercent = ((counts.unique / MAX_POKEMON_ID) * 100).toFixed(1);
            
            const embed = new EmbedBuilder()
                .setTitle(`📕 Pokédex de ${interaction.user.username}`)
                .setDescription(
                    `**#${startId.toString().padStart(3, '0')}** à **#${endId.toString().padStart(3, '0')}** — ${caughtInRange}/${endId - startId + 1} capturés${shinyInRange > 0 ? ` (${shinyInRange} ✨)` : ''}\n\n` +
                    `**Filtres :** \`$dex legendary\` • \`$dex mythical\` • \`$dex starter\` • \`$dex pseudo\` • \`$dex shiny\``
                )
                .setColor(0xE74C3C)
                .setImage('attachment://pokedex.png')
                .addFields(
                    { name: '📊 Total', value: `${counts.unique}/${MAX_POKEMON_ID} (${completionPercent}%)`, inline: true },
                    { name: '🎯 Attrapés', value: `${counts.total}`, inline: true },
                    { name: '✨ Shinies', value: `${counts.shiny}`, inline: true }
                )
                .setFooter({ text: `Page ${newPage}/${totalPages}` });
            
            const navRow = createPokedexNavButtons(newPage, totalPages, 'dex_main', userId);
            
            await interaction.editReply({ embeds: [embed], files: [attachment], components: [navRow] });
        } else {
            // Filtered Pokedex
            const filterData = getFilteredPokemonIds(filterType);
            if (!filterData) return true;
            
            let filteredIds = filterData.ids;
            
            if (filterData.special === 'shiny') {
                filteredIds = [...caughtMap.entries()]
                    .filter(([id, entry]) => entry.shiny_caught)
                    .map(([id]) => id)
                    .sort((a, b) => a - b);
            }
            
            if (!filteredIds || filteredIds.length === 0) return true;
            
            const perPage = 35;
            const startIdx = (newPage - 1) * perPage;
            const pageIds = filteredIds.slice(startIdx, startIdx + perPage);
            
            let caughtCount = 0;
            let shinyCount = 0;
            for (const id of filteredIds) {
                const entry = caughtMap.get(id);
                if (entry) {
                    caughtCount++;
                    if (entry.shiny_caught) shinyCount++;
                }
            }
            
            const imageBuffer = await generateFilteredPokedexImage(pageIds, caughtMap, filterData.bgColor);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'pokedex-filtered.png' });
            
            const completionPercent = ((caughtCount / filteredIds.length) * 100).toFixed(1);
            
            const embed = new EmbedBuilder()
                .setTitle(`${filterData.emoji} Pokédex - ${filterData.name}`)
                .setDescription(`**${caughtCount}/${filteredIds.length}** capturés (${completionPercent}%)${shinyCount > 0 ? ` • ${shinyCount} ✨` : ''}`)
                .setColor(filterData.color)
                .setImage('attachment://pokedex-filtered.png')
                .setFooter({ text: `Page ${newPage}/${totalPages}` });
            
            const navRow = createPokedexNavButtons(newPage, totalPages, `dex_${filterType}`, userId);
            
            await interaction.editReply({ embeds: [embed], files: [attachment], components: [navRow] });
        }
    } catch (error) {
        console.error('Error updating pokedex page:', error);
        await interaction.followUp({ content: '❌ Erreur lors du changement de page.', ephemeral: true });
    }
    
    return true;
}

/**
 * Handle shiny button interaction
 */
export async function handlePokemonInteraction(interaction) {
    if (!interaction.customId.startsWith('pokemon_shiny_')) return false;
    
    await interaction.deferReply({ ephemeral: true });
    
    const pokemonId = interaction.customId.split('_')[2];
    const pokemon = await fetchPokemon(pokemonId);
    
    if (!pokemon) {
        await interaction.editReply({ content: '❌ Erreur lors du chargement du shiny.' });
        return true;
    }
    
    const species = await fetchSpecies(pokemonId);
    const frenchName = getFrenchName(species, pokemon.name);
    const description = getFrenchDescription(species);
    const rarity = getRarity(pokemon.id, species);
    
    try {
        // Generate shiny card image
        const imageBuffer = await generatePokemonInfoImage(pokemon, species, frenchName, description, rarity, true);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'pokemon-shiny.png' });
        
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setImage('attachment://pokemon-shiny.png')
            .setFooter({ text: 'Chance d\'obtenir un shiny: 1/100' });
        
        await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
        console.error('Error generating shiny card:', error);
        
        // Fallback to simple embed
        const shinySprite = pokemon.sprites.other?.['official-artwork']?.front_shiny || pokemon.sprites.front_shiny;
        const embed = new EmbedBuilder()
            .setTitle(`✨ ${frenchName} Shiny`)
            .setImage(shinySprite)
            .setColor(0xFFD700)
            .setFooter({ text: 'Chance d\'obtenir un shiny: 1/100' });
        
        await interaction.editReply({ embeds: [embed] });
    }
    
    return true;
}
