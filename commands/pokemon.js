import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import * as db from '../database.js';

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
 * Pokedex command - View caught Pokemon progress
 */
export async function pokedexCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const pokedex = await db.getPokedex(userId, guildId);
    const counts = await db.getPokemonCounts(userId, guildId);
    
    if (pokedex.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('📕 Pokédex')
            .setDescription('Ton Pokédex est vide ! Utilise `$catch` pour capturer des Pokémon.')
            .setColor(0xff0000);
        return message.reply({ embeds: [embed] });
    }
    
    // Pagination
    const page = parseInt(args[0]) || 1;
    const perPage = 15;
    const totalPages = Math.ceil(pokedex.length / perPage);
    const startIndex = (page - 1) * perPage;
    const pageEntries = pokedex.slice(startIndex, startIndex + perPage);
    
    // Show loading message
    const loadingEmbed = new EmbedBuilder()
        .setDescription('🔍 Chargement du Pokédex...')
        .setColor(0x3498db);
    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });
    
    // Fetch French names for all Pokemon on this page
    const speciesData = await Promise.all(
        pageEntries.map(entry => fetchSpecies(entry.pokemon_id))
    );
    
    const entryList = pageEntries.map((entry, index) => {
        const shinyMark = entry.shiny_caught ? ' ✨' : '';
        const frenchName = getFrenchName(speciesData[index], entry.pokemon_name);
        return `#${entry.pokemon_id.toString().padStart(3, '0')} ${frenchName}${shinyMark} (x${entry.caught_count})`;
    }).join('\n');
    
    const completionPercent = ((counts.unique / MAX_POKEMON_ID) * 100).toFixed(1);
    
    const embed = new EmbedBuilder()
        .setTitle(`📕 Pokédex de ${message.author.username}`)
        .setDescription(`\`\`\`\n${entryList}\n\`\`\``)
        .setColor(0xE74C3C)
        .addFields(
            { name: '📊 Progression', value: `${counts.unique}/${MAX_POKEMON_ID} (${completionPercent}%)`, inline: true },
            { name: '🎯 Total capturés', value: `${counts.total}`, inline: true },
            { name: '✨ Shinies', value: `${counts.shiny}`, inline: true }
        )
        .setFooter({ text: `Page ${page}/${totalPages} • Utilise $pokedex <page> pour naviguer` });
    
    await loadingMsg.edit({ embeds: [embed] });
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
    
    // Stats with compact 5-segment bars (aligned)
    const stats = pokemon.stats.map(s => {
        const statNames = {
            'hp': 'PV ', 'attack': 'ATK', 'defense': 'DEF',
            'special-attack': 'SPA', 'special-defense': 'SPD', 'speed': 'VIT'
        };
        const name = statNames[s.stat.name] || s.stat.name;
        const value = s.base_stat;
        const filled = Math.min(5, Math.round(value / 40)); // 0-5 scale
        
        // Color based on stat value
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
    
    // Add shiny button
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`pokemon_shiny_${pokemon.id}`)
                .setLabel('✨ Voir Shiny')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await loadingMsg.edit({ embeds: [embed], components: [row] });
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
    
    const pokemonId = interaction.customId.split('_')[2];
    const pokemon = await fetchPokemon(pokemonId);
    
    if (!pokemon) {
        await interaction.reply({ content: '❌ Erreur lors du chargement du shiny.', ephemeral: true });
        return true;
    }
    
    const species = await fetchSpecies(pokemonId);
    const frenchName = getFrenchName(species, pokemon.name);
    const shinySprite = pokemon.sprites.other['official-artwork']?.front_shiny || pokemon.sprites.front_shiny;
    
    const embed = new EmbedBuilder()
        .setTitle(`✨ ${frenchName} Shiny`)
        .setImage(shinySprite || pokemon.sprites.front_shiny)
        .setColor(0xFFD700)
        .setFooter({ text: 'Chance d\'obtenir un shiny: 1/100' });
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
}
