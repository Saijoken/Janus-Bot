import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import * as db from '../database.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

// Cache for Pokemon data (to reduce API calls)
const pokemonCache = new Map();
const speciesCache = new Map();
// Cache for French names -> Pokemon ID mapping
const frenchNameToIdCache = new Map();

// Pokemon rarity tiers (based on Pokemon ID ranges and specific Pokemon)
const RARITY_TIERS = {
    legendary: {
        // Complete list of all legendary Pokemon (Gen 1-9)
        ids: [
            // Gen 1: Articuno, Zapdos, Moltres, Mewtwo
            144, 145, 146, 150,
            // Gen 2: Raikou, Entei, Suicune, Lugia, Ho-Oh
            243, 244, 245, 249, 250,
            // Gen 3: Regirock, Regice, Registeel, Latias, Latios, Kyogre, Groudon, Rayquaza
            377, 378, 379, 380, 381, 382, 383, 384,
            // Gen 4: Uxie, Mesprit, Azelf, Dialga, Palkia, Heatran, Regigigas, Giratina, Cresselia
            480, 481, 482, 483, 484, 485, 486, 487, 488,
            // Gen 5: Cobalion, Terrakion, Virizion, Tornadus, Thundurus, Reshiram, Zekrom, Landorus, Kyurem
            638, 639, 640, 641, 642, 643, 644, 645, 646,
            // Gen 6: Xerneas, Yveltal, Zygarde
            716, 717, 718,
            // Gen 7: Type:Null, Silvally, Tapu Koko/Lele/Bulu/Fini, Cosmog, Cosmoem, Solgaleo, Lunala, Necrozma
            772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 800,
            // Gen 8: Zacian, Zamazenta, Eternatus, Kubfu, Urshifu, Regieleki, Regidrago, Glastrier, Spectrier, Calyrex
            888, 889, 890, 891, 892, 894, 895, 896, 897, 898,
            // Gen 9: Wo-Chien, Chien-Pao, Ting-Lu, Chi-Yu, Koraidon, Miraidon, Ogerpon, Terapagos
            1001, 1002, 1003, 1004, 1007, 1008, 1017, 1024
        ],
        chance: 1, // 1% chance
        color: 0xFFD700,
        emoji: '🌟'
    },
    mythical: {
        // Complete list of all mythical/fabulous Pokemon (Gen 1-9)
        ids: [
            // Gen 1: Mew
            151,
            // Gen 2: Celebi
            251,
            // Gen 3: Jirachi, Deoxys
            385, 386,
            // Gen 4: Phione, Manaphy, Darkrai, Shaymin, Arceus
            489, 490, 491, 492, 493,
            // Gen 5: Victini, Keldeo, Meloetta, Genesect
            494, 647, 648, 649,
            // Gen 6: Diancie, Hoopa, Volcanion
            719, 720, 721,
            // Gen 7: Magearna, Marshadow, Zeraora, Meltan, Melmetal
            801, 802, 807, 808, 809,
            // Gen 8: Zarude
            893,
            // Gen 9: Pecharunt
            1025
        ],
        chance: 3, // 3% chance
        color: 0xFF00FF,
        emoji: '✨'
    },
    rare: {
        // Pseudo-legendaries (600 base stats) - very powerful Pokemon
        ids: [
            // Gen 1: Dragonite
            149,
            // Gen 2: Tyranitar
            248,
            // Gen 3: Salamence, Metagross
            373, 376,
            // Gen 4: Garchomp
            445,
            // Gen 5: Hydreigon
            635,
            // Gen 6: Goodra
            706,
            // Gen 7: Kommo-o
            784,
            // Gen 8: Dragapult
            887,
            // Gen 9: Baxcalibur
            998
        ],
        // All starters from all generations (Gen 1-9)
        idRanges: [
            [1, 9],     // Gen 1: Bulbasaur -> Blastoise
            [152, 160], // Gen 2: Chikorita -> Feraligatr
            [252, 260], // Gen 3: Treecko -> Swampert
            [387, 395], // Gen 4: Turtwig -> Empoleon
            [495, 503], // Gen 5: Snivy -> Samurott
            [650, 658], // Gen 6: Chespin -> Greninja
            [722, 730], // Gen 7: Rowlet -> Primarina
            [810, 818], // Gen 8: Grookey -> Inteleon
            [906, 914]  // Gen 9: Sprigatito -> Quaquaval
        ],
        chance: 5, // 5% chance
        color: 0x9B59B6,
        emoji: '💎'
    },
    uncommon: {
        // Pokemon that evolve or have decent stats (assigned dynamically)
        chance: 35, // 35% chance
        color: 0x3498DB,
        emoji: '🔵'
    },
    common: {
        // Basic Pokemon, first stages (assigned dynamically)
        chance: 56, // 56% chance (100 - 1 - 3 - 5 - 35 = 56)
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

// Pseudo-legendaries list (for QTE check - same as rare.ids)
const PSEUDO_LEGENDARIES = [149, 248, 373, 376, 445, 635, 706, 784, 887, 998];

// QTE settings for legendary catches
const QTE_TIME_LIMIT = 3000; // 3 seconds to react

// Active QTE sessions
const activeQTEs = new Map();

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
        
        // Cache French name for reverse lookup
        const frName = data.names?.find(n => n.language.name === 'fr');
        if (frName) {
            frenchNameToIdCache.set(frName.name.toLowerCase(), data.id);
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching species:', error);
        return null;
    }
}

/**
 * Get a random Pokemon ID based on rarity
 */
function getRandomPokemonId() {
    const roll = Math.random() * 100;
    let cumulative = 0;
    
    // Check legendary (1%)
    cumulative += RARITY_TIERS.legendary.chance;
    if (roll < cumulative) {
        const legendaries = RARITY_TIERS.legendary.ids;
        return legendaries[Math.floor(Math.random() * legendaries.length)];
    }
    
    // Check mythical/fabulous (3%)
    cumulative += RARITY_TIERS.mythical.chance;
    if (roll < cumulative) {
        const mythicals = RARITY_TIERS.mythical.ids;
        return mythicals[Math.floor(Math.random() * mythicals.length)];
    }
    
    // Check rare - pseudo-legendaries and starters (5%)
    cumulative += RARITY_TIERS.rare.chance;
    if (roll < cumulative) {
        // 30% chance for pseudo-legendary, 70% for starter
        if (Math.random() < 0.3 && RARITY_TIERS.rare.ids.length > 0) {
            // Pseudo-legendary
            const pseudoLegendaries = RARITY_TIERS.rare.ids;
            return pseudoLegendaries[Math.floor(Math.random() * pseudoLegendaries.length)];
        } else {
            // Starter
            const ranges = RARITY_TIERS.rare.idRanges;
            const range = ranges[Math.floor(Math.random() * ranges.length)];
            return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
        }
    }
    
    // Uncommon (35%) + Common (56%) - random from all Pokemon
    // Rarity is determined by getRarity() based on evolution status
    return Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
}

/**
 * Get rarity info for a Pokemon
 * @param {number} pokemonId - The Pokemon ID
 * @param {object} species - Optional species data to determine if evolved
 */
function getRarity(pokemonId, species = null) {
    if (RARITY_TIERS.legendary.ids.includes(pokemonId)) {
        return { name: 'Légendaire', ...RARITY_TIERS.legendary };
    }
    if (RARITY_TIERS.mythical.ids.includes(pokemonId)) {
        return { name: 'Fabuleux', ...RARITY_TIERS.mythical };
    }
    
    // Check pseudo-legendaries (in rare.ids)
    if (RARITY_TIERS.rare.ids.includes(pokemonId)) {
        return { name: 'Pseudo-Légendaire', ...RARITY_TIERS.rare };
    }
    
    // Check starters (in rare.idRanges)
    for (const range of RARITY_TIERS.rare.idRanges || []) {
        if (pokemonId >= range[0] && pokemonId <= range[1]) {
            return { name: 'Starter', ...RARITY_TIERS.rare };
        }
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
    
    // Fallback: random based on configured chances (35% uncommon, 56% common)
    // Ratio: 35/(35+56) = 38.5% chance for uncommon
    if (Math.random() < 0.385) {
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
 * Get French name from species data
 */
function getFrenchName(species, fallbackName) {
    if (!species?.names) return capitalize(fallbackName);
    
    const frName = species.names.find(n => n.language.name === 'fr');
    if (frName) return frName.name;
    
    return capitalize(fallbackName);
}

// French to English name mapping for instant lookup
const FRENCH_TO_ENGLISH = {
    // Gen 1
    'bulbizarre': 'bulbasaur', 'herbizarre': 'ivysaur', 'florizarre': 'venusaur',
    'salamèche': 'charmander', 'reptincel': 'charmeleon', 'dracaufeu': 'charizard',
    'carapuce': 'squirtle', 'carabaffe': 'wartortle', 'tortank': 'blastoise',
    'chenipan': 'caterpie', 'chrysacier': 'metapod', 'papilusion': 'butterfree',
    'aspicot': 'weedle', 'coconfort': 'kakuna', 'dardargnan': 'beedrill',
    'roucool': 'pidgey', 'roucoups': 'pidgeotto', 'roucarnage': 'pidgeot',
    'rattata': 'rattata', 'rattatac': 'raticate', 'piafabec': 'spearow', 'rapasdepic': 'fearow',
    'abo': 'ekans', 'arbok': 'arbok', 'pikachu': 'pikachu', 'raichu': 'raichu',
    'sabelette': 'sandshrew', 'sablaireau': 'sandslash', 'nidoran♀': 'nidoran-f', 'nidorina': 'nidorina',
    'nidoqueen': 'nidoqueen', 'nidoran♂': 'nidoran-m', 'nidorino': 'nidorino', 'nidoking': 'nidoking',
    'mélofée': 'clefairy', 'mélodelfe': 'clefable', 'goupix': 'vulpix', 'feunard': 'ninetales',
    'rondoudou': 'jigglypuff', 'grodoudou': 'wigglytuff', 'nosferapti': 'zubat', 'nosferalto': 'golbat',
    'mystherbe': 'oddish', 'ortide': 'gloom', 'rafflesia': 'vileplume', 'paras': 'paras',
    'parasect': 'parasect', 'mimitoss': 'venonat', 'aéromite': 'venomoth', 'taupiqueur': 'diglett',
    'triopikeur': 'dugtrio', 'miaouss': 'meowth', 'persian': 'persian', 'psykokwak': 'psyduck',
    'akwakwak': 'golduck', 'férosinge': 'mankey', 'colossinge': 'primeape', 'caninos': 'growlithe',
    'arcanin': 'arcanine', 'ptitard': 'poliwag', 'têtarte': 'poliwhirl', 'tartard': 'poliwrath',
    'abra': 'abra', 'kadabra': 'kadabra', 'alakazam': 'alakazam', 'machoc': 'machop',
    'machopeur': 'machoke', 'mackogneur': 'machamp', 'chétiflor': 'bellsprout', 'boustiflor': 'weepinbell',
    'empiflor': 'victreebel', 'tentacool': 'tentacool', 'tentacruel': 'tentacruel', 'racaillou': 'geodude',
    'gravalanch': 'graveler', 'grolem': 'golem', 'ponyta': 'ponyta', 'galopa': 'rapidash',
    'ramoloss': 'slowpoke', 'flagadoss': 'slowbro', 'magnéti': 'magnemite', 'magnéton': 'magneton',
    'canarticho': 'farfetchd', 'doduo': 'doduo', 'dodrio': 'dodrio', 'otaria': 'seel',
    'lamantine': 'dewgong', 'tadmorv': 'grimer', 'grotadmorv': 'muk', 'kokiyas': 'shellder',
    'crustabri': 'cloyster', 'fantominus': 'gastly', 'spectrum': 'haunter', 'ectoplasma': 'gengar',
    'onix': 'onix', 'soporifik': 'drowzee', 'hypnomade': 'hypno', 'krabby': 'krabby',
    'krabboss': 'kingler', 'voltorbe': 'voltorb', 'électrode': 'electrode', 'noeunoeuf': 'exeggcute',
    'noadkoko': 'exeggutor', 'osselait': 'cubone', 'ossatueur': 'marowak', 'tygnon': 'hitmonchan',
    'kicklee': 'hitmonlee', 'excelangue': 'lickitung', 'smogo': 'koffing', 'smogogo': 'weezing',
    'rhinocorne': 'rhyhorn', 'rhinoféros': 'rhydon', 'leveinard': 'chansey', 'saquedeneu': 'tangela',
    'kangourex': 'kangaskhan', 'hypotrempe': 'horsea', 'hypocéan': 'seadra', 'poissirène': 'goldeen',
    'poissoroy': 'seaking', 'stari': 'staryu', 'staross': 'starmie', 'mime jr.': 'mime-jr',
    'm. mime': 'mr-mime', 'insécateur': 'scyther', 'lippoutou': 'jynx', 'élektek': 'electabuzz',
    'magmar': 'magmar', 'scarabrute': 'pinsir', 'tauros': 'tauros', 'magicarpe': 'magikarp',
    'léviator': 'gyarados', 'lokhlass': 'lapras', 'métamorph': 'ditto', 'évoli': 'eevee',
    'aquali': 'vaporeon', 'voltali': 'jolteon', 'pyroli': 'flareon', 'porygon': 'porygon',
    'amonita': 'omanyte', 'amonistar': 'omastar', 'kabuto': 'kabuto', 'kabutops': 'kabutops',
    'ptéra': 'aerodactyl', 'ronflex': 'snorlax', 'artikodin': 'articuno', 'électhor': 'zapdos',
    'sulfura': 'moltres', 'minidraco': 'dratini', 'draco': 'dragonair', 'dracolosse': 'dragonite',
    'mewtwo': 'mewtwo', 'mew': 'mew',
    // Gen 2
    'germignon': 'chikorita', 'macronium': 'bayleef', 'méganium': 'meganium',
    'héricendre': 'cyndaquil', 'feurisson': 'quilava', 'typhlosion': 'typhlosion',
    'kaiminus': 'totodile', 'crocrodil': 'croconaw', 'aligatueur': 'feraligatr',
    'fouinette': 'sentret', 'fouinar': 'furret', 'hoothoot': 'hoothoot', 'noarfang': 'noctowl',
    'coxy': 'ledyba', 'coxyclaque': 'ledian', 'mimigal': 'spinarak', 'migalos': 'ariados',
    'nostenfer': 'crobat', 'loupio': 'chinchou', 'lanturn': 'lanturn', 'pichu': 'pichu',
    'mélo': 'cleffa', 'toudoudou': 'igglybuff', 'togepi': 'togepi', 'togetic': 'togetic',
    'natu': 'natu', 'xatu': 'xatu', 'wattouat': 'mareep', 'lainergie': 'flaaffy',
    'pharamp': 'ampharos', 'joliflor': 'bellossom', 'marill': 'marill', 'azumarill': 'azumarill',
    'simularbre': 'sudowoodo', 'tarpaud': 'politoed', 'granivol': 'hoppip', 'floravol': 'skiploom',
    'cotovol': 'jumpluff', 'capumain': 'aipom', 'tournegrin': 'sunkern', 'héliatronc': 'sunflora',
    'yanma': 'yanma', 'axoloto': 'wooper', 'maraiste': 'quagsire', 'mentali': 'espeon',
    'noctali': 'umbreon', 'cornèbre': 'murkrow', 'roigada': 'slowking', 'feuforêve': 'misdreavus',
    'zarbi': 'unown', 'qulbutoké': 'wobbuffet', 'girafarig': 'girafarig', 'pomdepik': 'pineco',
    'foretress': 'forretress', 'insolourdo': 'dunsparce', 'scorplane': 'gligar', 'steelix': 'steelix',
    'snubbull': 'snubbull', 'granbull': 'granbull', 'qwilfish': 'qwilfish', 'cizayox': 'scizor',
    'caratroc': 'shuckle', 'scarhino': 'heracross', 'farfuret': 'sneasel', 'teddiursa': 'teddiursa',
    'ursaring': 'ursaring', 'limagma': 'slugma', 'volcaropod': 'magcargo', 'marcacrin': 'swinub',
    'cochignon': 'piloswine', 'corayon': 'corsola', 'rémoraid': 'remoraid', 'octillery': 'octillery',
    'cadoizo': 'delibird', 'démanta': 'mantine', 'airmure': 'skarmory', 'malosse': 'houndour',
    'démolosse': 'houndoom', 'hyporoi': 'kingdra', 'phanpy': 'phanpy', 'donphan': 'donphan',
    'porygon2': 'porygon2', 'cerfrousse': 'stantler', 'queulorior': 'smeargle', 'debugant': 'tyrogue',
    'kapoera': 'hitmontop', 'lippouti': 'smoochum', 'élekid': 'elekid', 'magby': 'magby',
    'écrémeuh': 'miltank', 'leuphorie': 'blissey', 'raikou': 'raikou', 'entei': 'entei',
    'suicune': 'suicune', 'embrylex': 'larvitar', 'ymphect': 'pupitar', 'tyranocif': 'tyranitar',
    'lugia': 'lugia', 'ho-oh': 'ho-oh', 'celebi': 'celebi',
    // Gen 3 legendaries & starters
    'arcko': 'treecko', 'massko': 'grovyle', 'jungko': 'sceptile',
    'poussifeu': 'torchic', 'galifeu': 'combusken', 'braségali': 'blaziken',
    'gobou': 'mudkip', 'flobio': 'marshtomp', 'laggron': 'swampert',
    'regirock': 'regirock', 'regice': 'regice', 'registeel': 'registeel',
    'latias': 'latias', 'latios': 'latios', 'kyogre': 'kyogre', 'groudon': 'groudon',
    'rayquaza': 'rayquaza', 'jirachi': 'jirachi', 'deoxys': 'deoxys',
    // Gen 4 legendaries & popular
    'dialga': 'dialga', 'palkia': 'palkia', 'giratina': 'giratina',
    'créhelf': 'uxie', 'créfollet': 'mesprit', 'créfadet': 'azelf',
    'heatran': 'heatran', 'regigigas': 'regigigas', 'cresselia': 'cresselia',
    'phione': 'phione', 'manaphy': 'manaphy', 'darkrai': 'darkrai',
    'shaymin': 'shaymin', 'arceus': 'arceus', 'lucario': 'lucario',
    'riolu': 'riolu', 'carchacrok': 'garchomp', 'carmache': 'gabite', 'griknot': 'gible',
    // Gen 5
    'victini': 'victini', 'reshiram': 'reshiram', 'zekrom': 'zekrom', 'kyurem': 'kyurem',
    'cobaltium': 'cobalion', 'terrakium': 'terrakion', 'viridium': 'virizion',
    'boréas': 'tornadus', 'fulguris': 'thundurus', 'démétéros': 'landorus',
    'keldeo': 'keldeo', 'meloetta': 'meloetta', 'genesect': 'genesect',
    // Gen 6
    'xerneas': 'xerneas', 'yveltal': 'yveltal', 'zygarde': 'zygarde',
    'diancie': 'diancie', 'hoopa': 'hoopa', 'volcanion': 'volcanion',
    // Gen 7
    'cosmog': 'cosmog', 'cosmovum': 'cosmoem', 'solgaleo': 'solgaleo', 'lunala': 'lunala',
    'necrozma': 'necrozma', 'magearna': 'magearna', 'marshadow': 'marshadow',
    'zeraora': 'zeraora',
    // Gen 8
    'zacian': 'zacian', 'zamazenta': 'zamazenta', 'éthernatos': 'eternatus',
    'kubfu': 'kubfu', 'shifours': 'urshifu', 'zarude': 'zarude', 'sylveroy': 'calyrex',
    // Gen 9 - Starters
    'poussacha': 'sprigatito', 'matourgeon': 'floragato', 'miascarade': 'meowscarada',
    'chochodile': 'fuecoco', 'crocogril': 'crocalor', 'flâmigator': 'skeledirge',
    'coiffeton': 'quaxly', 'canarbello': 'quaxwell', 'palmaval': 'quaquaval',
    // Gen 9 - Legendaries
    'koraidon': 'koraidon', 'miraidon': 'miraidon',
    'chongjian': 'wo-chien', 'baojian': 'chien-pao', 'dinglu': 'ting-lu', 'yuyu': 'chi-yu',
    'ogerpon': 'ogerpon', 'terapagos': 'terapagos', 'félécanis': 'okidogi',
    'poltchageist': 'poltchageist', 'sinistcha': 'sinistcha',
    // Gen 9 - Pseudo-legendary
    'frigodo': 'frigibax', 'cryodo': 'arctibax', 'glaivodo': 'baxcalibur',
    // Gen 9 - Mythical
    'pêchaminus': 'pecharunt'
};

/**
 * Find Pokemon by name (French or English) or ID
 * Returns the Pokemon data or null if not found
 */
/**
 * Remove accents from a string for accent-insensitive comparison
 */
function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Pre-compute accent-free version of French names for faster lookup
const FRENCH_TO_ENGLISH_NO_ACCENTS = {};
for (const [frenchName, englishName] of Object.entries(FRENCH_TO_ENGLISH)) {
    FRENCH_TO_ENGLISH_NO_ACCENTS[removeAccents(frenchName)] = englishName;
}

async function findPokemon(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const noAccentQuery = removeAccents(normalizedQuery);
    
    // First, try direct lookup (English name or ID)
    let pokemon = await fetchPokemon(normalizedQuery);
    if (pokemon) return pokemon;
    
    // Check French to English mapping (with accents)
    if (FRENCH_TO_ENGLISH[normalizedQuery]) {
        pokemon = await fetchPokemon(FRENCH_TO_ENGLISH[normalizedQuery]);
        if (pokemon) return pokemon;
    }
    
    // Check French to English mapping (without accents)
    if (FRENCH_TO_ENGLISH_NO_ACCENTS[noAccentQuery]) {
        pokemon = await fetchPokemon(FRENCH_TO_ENGLISH_NO_ACCENTS[noAccentQuery]);
        if (pokemon) return pokemon;
    }
    
    // Check if we have this French name in dynamic cache (with accents)
    if (frenchNameToIdCache.has(normalizedQuery)) {
        const pokemonId = frenchNameToIdCache.get(normalizedQuery);
        return await fetchPokemon(pokemonId);
    }
    
    // Check dynamic cache without accents
    for (const [cachedName, pokemonId] of frenchNameToIdCache.entries()) {
        if (removeAccents(cachedName) === noAccentQuery) {
            return await fetchPokemon(pokemonId);
        }
    }
    
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
        
        const counts = await db.getPokemonCounts(userId, guildId);
        
        const embed = new EmbedBuilder()
            .setTitle(`${isShiny ? '✨ SHINY ! ' : ''}${rarity.emoji} Un ${frenchName} sauvage est apparu !`)
            .setDescription(
                `**Tu as capturé ${isShiny ? '✨ ' : ''}${frenchName} !**\n\n` +
                `📊 **Infos:**\n` +
                `• Type: ${formatTypes(pokemon.types)}\n` +
                `• Rareté: ${rarity.name}\n` +
                `• N° Pokédex: #${pokemon.id}\n` +
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
 * Pokedex command - View caught Pokemon progress in grid format
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
            .setDescription(`**#${startId.toString().padStart(3, '0')}** à **#${endId.toString().padStart(3, '0')}** — ${caughtInRange}/${endId - startId + 1} capturés${shinyInRange > 0 ? ` (${shinyInRange} ✨)` : ''}`)
            .setColor(0xE74C3C)
            .setImage('attachment://pokedex.png')
            .addFields(
                { name: '📊 Total', value: `${counts.unique}/${MAX_POKEMON_ID} (${completionPercent}%)`, inline: true },
                { name: '🎯 Attrapés', value: `${counts.total}`, inline: true },
                { name: '✨ Shinies', value: `${counts.shiny}`, inline: true }
            )
            .setFooter({ text: `Page ${page}/${totalPages} • $pokedex <page> pour naviguer` });
        
        await loadingMsg.edit({ embeds: [embed], files: [attachment] });
    } catch (error) {
        console.error('Error generating pokedex image:', error);
        
        // Fallback to text
        const embed = new EmbedBuilder()
            .setTitle(`📕 Pokédex de ${message.author.username}`)
            .setDescription(`Erreur lors de la génération de l'image.\n\n**Progression:** ${counts.unique}/${MAX_POKEMON_ID} Pokémon capturés`)
            .setColor(0xE74C3C);
        
        await loadingMsg.edit({ embeds: [embed] });
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
        const date = new Date(p.caught_at).toLocaleDateString('fr-FR');
        const frenchName = getFrenchName(speciesData[i], p.pokemon_name);
        return `**${offset + i + 1}.** #${p.pokemon_id} ${frenchName}${shiny} • *${date}*`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle(`📦 PC de ${message.author.username}`)
        .setDescription(pokemonList)
        .setColor(0x3498db)
        .addFields(
            { name: '📊 Total', value: `${counts.total} Pokémon`, inline: true },
            { name: '✨ Shinies', value: `${counts.shiny}`, inline: true }
        )
        .setFooter({ text: `Page ${page}/${totalPages} • Utilise $pc <page> pour naviguer` });
    
    await loadingMsg.edit({ embeds: [embed] });
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
