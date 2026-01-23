import {
    canFish,
    updateLastFish,
    addFish,
    getFishInventory,
    getFishCollection,
    removeFish,
    addMoney,
    getBalance,
    checkCollectionComplete,
    markCollectionComplete,
    hasCollectionAchievement,
    getUserAchievements
} from '../database.js';
import { EmbedBuilder } from 'discord.js';

// Fish definitions with rarity, emoji, and sell price
// Total: 64 poissons collectionnables
export const FISH = {
    // Common (20 poissons - 60% chance)
    'Poisson-Rouge': { rarity: 'common', emoji: '🐟', price: 50, chance: 60 },
    'Truite': { rarity: 'common', emoji: '🐟', price: 75, chance: 60 },
    'Carpe': { rarity: 'common', emoji: '🐟', price: 60, chance: 60 },
    'Brochet': { rarity: 'common', emoji: '🐟', price: 80, chance: 60 },
    'Gardon': { rarity: 'common', emoji: '🐟', price: 55, chance: 60 },
    'Perche': { rarity: 'common', emoji: '🐟', price: 65, chance: 60 },
    'Tanche': { rarity: 'common', emoji: '🐟', price: 70, chance: 60 },
    'Anguille': { rarity: 'common', emoji: '🐟', price: 85, chance: 60 },
    'Silure': { rarity: 'common', emoji: '🐟', price: 90, chance: 60 },
    'Sandre': { rarity: 'common', emoji: '🐟', price: 95, chance: 60 },
    'Brème': { rarity: 'common', emoji: '🐟', price: 58, chance: 60 },
    'Rotengle': { rarity: 'common', emoji: '🐟', price: 62, chance: 60 },
    'Goujon': { rarity: 'common', emoji: '🐟', price: 45, chance: 60 },
    'Vandoise': { rarity: 'common', emoji: '🐟', price: 68, chance: 60 },
    'Chevesne': { rarity: 'common', emoji: '🐟', price: 72, chance: 60 },
    'Barbeau': { rarity: 'common', emoji: '🐟', price: 78, chance: 60 },
    'Hotu': { rarity: 'common', emoji: '🐟', price: 66, chance: 60 },
    'Ide': { rarity: 'common', emoji: '🐟', price: 64, chance: 60 },
    'Ombre': { rarity: 'common', emoji: '🐟', price: 88, chance: 60 },
    'Lotte': { rarity: 'common', emoji: '🐟', price: 92, chance: 60 },
    
    // Uncommon (16 poissons - 25% chance)
    'Saumon': { rarity: 'uncommon', emoji: '🐠', price: 200, chance: 25 },
    'Thon': { rarity: 'uncommon', emoji: '🐠', price: 250, chance: 25 },
    'Bar': { rarity: 'uncommon', emoji: '🐠', price: 180, chance: 25 },
    'Maquereau': { rarity: 'uncommon', emoji: '🐠', price: 220, chance: 25 },
    'Sardine': { rarity: 'uncommon', emoji: '🐠', price: 150, chance: 25 },
    'Anchois': { rarity: 'uncommon', emoji: '🐠', price: 170, chance: 25 },
    'Hareng': { rarity: 'uncommon', emoji: '🐠', price: 190, chance: 25 },
    'Merlan': { rarity: 'uncommon', emoji: '🐠', price: 210, chance: 25 },
    'Cabillaud': { rarity: 'uncommon', emoji: '🐠', price: 230, chance: 25 },
    'Colin': { rarity: 'uncommon', emoji: '🐠', price: 240, chance: 25 },
    'Lieu': { rarity: 'uncommon', emoji: '🐠', price: 195, chance: 25 },
    'Dorade': { rarity: 'uncommon', emoji: '🐠', price: 260, chance: 25 },
    'Rouget': { rarity: 'uncommon', emoji: '🐠', price: 275, chance: 25 },
    'Sole': { rarity: 'uncommon', emoji: '🐠', price: 280, chance: 25 },
    'Turbot': { rarity: 'uncommon', emoji: '🐠', price: 290, chance: 25 },
    'Plie': { rarity: 'uncommon', emoji: '🐠', price: 160, chance: 25 },
    
    // Rare (12 poissons - 10% chance)
    'Espadon': { rarity: 'rare', emoji: '🦈', price: 800, chance: 10 },
    'Requin': { rarity: 'rare', emoji: '🦈', price: 1000, chance: 10 },
    'Raie': { rarity: 'rare', emoji: '🦈', price: 900, chance: 10 },
    'Marlin': { rarity: 'rare', emoji: '🦈', price: 1200, chance: 10 },
    'Thazard': { rarity: 'rare', emoji: '🦈', price: 1100, chance: 10 },
    'Voilier': { rarity: 'rare', emoji: '🦈', price: 1300, chance: 10 },
    'Thon-Rouge': { rarity: 'rare', emoji: '🦈', price: 1400, chance: 10 },
    'Barracuda': { rarity: 'rare', emoji: '🦈', price: 950, chance: 10 },
    'Carangue': { rarity: 'rare', emoji: '🦈', price: 850, chance: 10 },
    'Coryphène': { rarity: 'rare', emoji: '🦈', price: 1050, chance: 10 },
    'Mahi-Mahi': { rarity: 'rare', emoji: '🦈', price: 1150, chance: 10 },
    'Wahoo': { rarity: 'rare', emoji: '🦈', price: 1250, chance: 10 },
    
    // Epic (8 poissons - 4% chance)
    'Poisson-Lune': { rarity: 'epic', emoji: '🌙', price: 3000, chance: 4 },
    'Poisson-Dragon': { rarity: 'epic', emoji: '🐉', price: 5000, chance: 4 },
    'Baleine': { rarity: 'epic', emoji: '🐋', price: 4000, chance: 4 },
    'Dauphin': { rarity: 'epic', emoji: '🐬', price: 3500, chance: 4 },
    'Orque': { rarity: 'epic', emoji: '🐋', price: 4500, chance: 4 },
    'Narval': { rarity: 'epic', emoji: '🦄', price: 5500, chance: 4 },
    'Rémora': { rarity: 'epic', emoji: '🌊', price: 3200, chance: 4 },
    'Poisson-Pilote': { rarity: 'epic', emoji: '🌊', price: 3800, chance: 4 },
    
    // Legendary (5 poissons - 0.8% chance)
    'Kraken': { rarity: 'legendary', emoji: '🐙', price: 15000, chance: 0.8 },
    'Léviathan': { rarity: 'legendary', emoji: '🌊', price: 20000, chance: 0.8 },
    'Poisson-Doré': { rarity: 'legendary', emoji: '✨', price: 25000, chance: 0.8 },
    'Megalodon': { rarity: 'legendary', emoji: '🦈', price: 30000, chance: 0.8 },
    'Serpent-de-Mer': { rarity: 'legendary', emoji: '🐍', price: 35000, chance: 0.8 },
    
    // Mythic (3 poissons - 0.2% chance) - Ultra rare!
    'Poisson-Céleste': { rarity: 'mythic', emoji: '⭐', price: 50000, chance: 0.2 },
    'Poisson-Phénix': { rarity: 'mythic', emoji: '🔥', price: 75000, chance: 0.2 },
    'Poisson-Dieu': { rarity: 'mythic', emoji: '👑', price: 100000, chance: 0.2 }
};

// Rarity colors
const RARITY_COLORS = {
    common: 0x808080,      // Gray
    uncommon: 0x00ff00,    // Green
    rare: 0x0080ff,        // Blue
    epic: 0x8000ff,        // Purple
    legendary: 0xff8000,   // Orange
    mythic: 0xff00ff       // Magenta
};

// Rarity names in French
export const RARITY_NAMES = {
    common: 'Commun',
    uncommon: 'Peu Commun',
    rare: 'Rare',
    epic: 'Épique',
    legendary: 'Légendaire',
    mythic: 'Mythique'
};

/**
 * Assign collection achievement role to user
 * Creates the role if it doesn't exist
 * @param {Guild} guild - Discord guild
 * @param {GuildMember} member - Discord member
 */
async function assignCollectionRole(guild, member) {
    const roleName = 'Maître Pêcheur';
    const roleColor = 0xffd700; // Gold color
    
    try {
        // Try to find existing role
        let role = guild.roles.cache.find(r => r.name === roleName);
        
        // Create role if it doesn't exist
        if (!role) {
            role = await guild.roles.create({
                name: roleName,
                color: roleColor,
                reason: 'Rôle créé pour l\'achievement de collection complète de poissons',
                mentionable: false,
                hoist: true // Show role separately in member list
            });
            console.log(`[${guild.name}] Created role "${roleName}" for collection achievement`);
        }
        
        // Assign role to member if they don't have it
        if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role, 'Collection complète de 64 poissons');
            console.log(`[${guild.name}] Assigned role "${roleName}" to ${member.user.username}`);
        }
        
        return role;
    } catch (error) {
        console.error(`[${guild.name}] Error assigning collection role:`, error);
        throw error;
    }
}

/**
 * Get a random fish based on rarity chances
 * @returns {Object} Fish object with name and data
 */
function getRandomFish() {
    const roll = Math.random() * 100;
    let cumulativeChance = 0;
    
    // Create arrays for each rarity tier
    const commonFish = Object.entries(FISH).filter(([_, data]) => data.rarity === 'common');
    const uncommonFish = Object.entries(FISH).filter(([_, data]) => data.rarity === 'uncommon');
    const rareFish = Object.entries(FISH).filter(([_, data]) => data.rarity === 'rare');
    const epicFish = Object.entries(FISH).filter(([_, data]) => data.rarity === 'epic');
    const legendaryFish = Object.entries(FISH).filter(([_, data]) => data.rarity === 'legendary');
    const mythicFish = Object.entries(FISH).filter(([_, data]) => data.rarity === 'mythic');
    
    // Determine rarity based on roll
    if (roll < 0.2) {
        // Mythic (0.2%)
        const fish = mythicFish[Math.floor(Math.random() * mythicFish.length)];
        return { name: fish[0], ...fish[1] };
    } else if (roll < 1.0) {
        // Legendary (0.8%)
        const fish = legendaryFish[Math.floor(Math.random() * legendaryFish.length)];
        return { name: fish[0], ...fish[1] };
    } else if (roll < 5.0) {
        // Epic (4%)
        const fish = epicFish[Math.floor(Math.random() * epicFish.length)];
        return { name: fish[0], ...fish[1] };
    } else if (roll < 15.0) {
        // Rare (10%)
        const fish = rareFish[Math.floor(Math.random() * rareFish.length)];
        return { name: fish[0], ...fish[1] };
    } else if (roll < 40.0) {
        // Uncommon (25%)
        const fish = uncommonFish[Math.floor(Math.random() * uncommonFish.length)];
        return { name: fish[0], ...fish[1] };
    } else {
        // Common (60%)
        const fish = commonFish[Math.floor(Math.random() * commonFish.length)];
        return { name: fish[0], ...fish[1] };
    }
}

/**
 * Fish command - Go fishing (1 hour cooldown)
 */
export async function fishCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const fishCheck = await canFish(userId, guildId);
    
    if (!fishCheck.canFish) {
        const minutes = Math.floor(fishCheck.timeRemaining / 60);
        const seconds = fishCheck.timeRemaining % 60;
        
        // Get next hour in Paris time
        const now = new Date();
        const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const nextHour = parisTime.getHours() + 1;
        const nextHourFormatted = nextHour.toString().padStart(2, '0') + 'h00';
        
        const embed = new EmbedBuilder()
            .setTitle('⏰ Pêche en attente')
            .setDescription(
                `**${message.author.username}**, vous devez attendre avant de pouvoir pêcher à nouveau !\n\n` +
                `⏱️ Temps restant: **${minutes} minutes et ${seconds} secondes**\n` +
                `🕐 Prochaine pêche disponible à **${nextHourFormatted}**`
            )
            .setColor(0xff0000)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Get random fish
    const caughtFish = getRandomFish();
    
    // Add fish to inventory
    await addFish(userId, guildId, caughtFish.name, 1);
    
    // Update last fish time
    await updateLastFish(userId, guildId);
    
    // Check if user has completed the collection
    let collectionComplete = false;
    let achievementUnlocked = false;
    
    if (!(await hasCollectionAchievement(userId, guildId))) {
        const collectionCheck = await checkCollectionComplete(userId, guildId, FISH);
        if (collectionCheck.hasAll) {
            collectionComplete = true;
            achievementUnlocked = true;
            await markCollectionComplete(userId, guildId);
            
            // Try to assign the special role
            try {
                await assignCollectionRole(message.guild, message.member);
            } catch (error) {
                console.error('Error assigning collection role:', error);
            }
        }
    }
    
    // Create embed based on rarity
    const rarityColor = RARITY_COLORS[caughtFish.rarity];
    const rarityName = RARITY_NAMES[caughtFish.rarity];
    
    // Special messages for rare fish
    let title = '🎣 Pêche réussie !';
    let description = `**${message.author.username}**, vous avez pêché un(e) **${caughtFish.name}** ${caughtFish.emoji} !`;
    
    if (achievementUnlocked) {
        title = '🏆 COLLECTION COMPLÈTE !';
        description = `**${message.author.username}**, vous avez pêché un(e) **${caughtFish.name}** ${caughtFish.emoji} !\n\n` +
                     `🎉 **FÉLICITATIONS !** Vous avez complété la collection de **64 poissons** !\n` +
                     `👑 Vous avez reçu le rôle **Maître Pêcheur** !`;
    } else if (caughtFish.rarity === 'legendary' || caughtFish.rarity === 'mythic') {
        title = '🌟 PÊCHE INCROYABLE !';
        description = `**${message.author.username}**, vous avez pêché un(e) **${caughtFish.name}** ${caughtFish.emoji} !\n\n` +
                     `🎉 **FÉLICITATIONS !** C'est un(e) poisson ${rarityName.toLowerCase()} ultra rare !`;
    } else if (caughtFish.rarity === 'epic') {
        title = '💎 Pêche exceptionnelle !';
        description = `**${message.author.username}**, vous avez pêché un(e) **${caughtFish.name}** ${caughtFish.emoji} !\n\n` +
                     `✨ Excellent travail ! C'est un(e) poisson ${rarityName.toLowerCase()} !`;
    } else if (caughtFish.rarity === 'rare') {
        description += `\n\n🎯 Bien joué ! C'est un(e) poisson ${rarityName.toLowerCase()} !`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .addFields(
            { name: '📊 Rareté', value: `**${rarityName}**`, inline: true },
            { name: '💰 Prix de vente', value: `**${caughtFish.price.toLocaleString()}** coins`, inline: true },
            { name: '📦 Inventaire', value: `Vous avez maintenant **${(await getFishInventory(userId, guildId))[caughtFish.name] || 1}** ${caughtFish.name}`, inline: false }
        )
        .setColor(achievementUnlocked ? 0xffd700 : rarityColor) // Gold color for achievement
        .setFooter({ text: 'Utilisez $sellfish [nom] pour vendre vos poissons' })
        .setTimestamp();
    
    // Add collection progress if not complete
    if (!collectionComplete && !(await hasCollectionAchievement(userId, guildId))) {
        const collectionCheck = await checkCollectionComplete(userId, guildId, FISH);
        embed.addFields({
            name: '📚 Progression Collection',
            value: `**${collectionCheck.collected}/${collectionCheck.total}** poissons collectionnés`,
            inline: false
        });
    }
    
    await message.reply({ embeds: [embed] });
}

/**
 * Find fish name case-insensitively
 * @param {string} searchName - Name to search for
 * @returns {string|null} Exact fish name or null if not found
 */
function findFishName(searchName) {
    const searchLower = searchName.toLowerCase();
    for (const fishName of Object.keys(FISH)) {
        if (fishName.toLowerCase() === searchLower) {
            return fishName;
        }
    }
    return null;
}

/**
 * Sell fish command - Sell fish from inventory
 */
export async function sellFishCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('💰 Vendre des poissons')
            .setDescription(
                '**Utilisation:** `$sellfish [nom] [quantité]` ou `$sellfish all`\n\n' +
                '**Exemples:**\n' +
                '• `$sellfish Poisson-Rouge` - Vendre 1 poisson\n' +
                '• `$sellfish saumon 5` - Vendre 5 saumons (insensible à la casse)\n' +
                '• `$sellfish all` - Vendre **TOUS** vos poissons d\'un coup\n\n' +
                'Utilisez `$inventory` pour voir vos poissons.'
            )
            .setColor(0x3498db)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Handle "all" case - sell all fish
    if (args[0].toLowerCase() === 'all') {
        const inventory = await getFishInventory(userId, guildId);
        
        // Check if inventory is empty
        const totalFish = Object.values(inventory).reduce((sum, count) => sum + count, 0);
        if (totalFish === 0) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Inventaire vide')
                .setDescription('Vous n\'avez aucun poisson à vendre !')
                .setColor(0xff0000)
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            return;
        }
        
        // Calculate total earnings and sell all fish
        let totalEarnings = 0;
        const soldFish = [];
        
        for (const [fishName, count] of Object.entries(inventory)) {
            if (count > 0 && FISH[fishName]) {
                const fishData = FISH[fishName];
                const fishEarnings = fishData.price * count;
                totalEarnings += fishEarnings;
                
                // Remove all fish of this type
                await removeFish(userId, guildId, fishName, count);
                
                soldFish.push({
                    name: fishName,
                    count: count,
                    emoji: fishData.emoji,
                    earnings: fishEarnings
                });
            }
        }
        
        // Add total money
        const newBalance = await addMoney(userId, guildId, totalEarnings, 'fish_sale', `Vendu tous les poissons (${totalFish} poissons)`);
        
        // Sort by earnings (highest first)
        soldFish.sort((a, b) => b.earnings - a.earnings);
        
        // Create summary description
        let description = `**${message.author.username}**, vous avez vendu **TOUS** vos poissons !\n\n`;
        description += `📊 **Résumé de la vente:**\n`;
        
        // Show top 10 fish by earnings, or all if less than 10
        const displayCount = Math.min(soldFish.length, 10);
        for (let i = 0; i < displayCount; i++) {
            const fish = soldFish[i];
            description += `${fish.emoji} **${fish.name}**: ${fish.count}x → **${fish.earnings.toLocaleString()}** coins\n`;
        }
        
        if (soldFish.length > 10) {
            description += `\n... et ${soldFish.length - 10} autre(s) type(s) de poisson(s)\n`;
        }
        
        description += `\n💰 **Total gagné:** **${totalEarnings.toLocaleString()}** coins\n`;
        description += `💵 **Nouveau solde:** **${newBalance.toLocaleString()}** coins`;
        
        const embed = new EmbedBuilder()
            .setTitle('💰 Vente massive réussie !')
            .setDescription(description)
            .setColor(0x00ff00)
            .setFooter({ text: `${totalFish} poisson(s) vendu(s) au total` })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    const searchName = args[0];
    const quantity = args[1] ? parseInt(args[1]) : 1;
    
    // Find fish name case-insensitively
    const fishName = findFishName(searchName);
    
    if (!fishName) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Poisson introuvable')
            .setDescription(`Le poisson **${searchName}** n'existe pas !\n\nUtilisez \`$inventory\` pour voir vos poissons.`)
            .setColor(0xff0000)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Check if user has the fish
    const inventory = await getFishInventory(userId, guildId);
    const fishCount = inventory[fishName] || 0;
    
    if (fishCount < quantity) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Quantité insuffisante')
            .setDescription(
                `Vous n'avez pas assez de **${fishName}** !\n\n` +
                `Vous avez: **${fishCount}**\n` +
                `Vous voulez vendre: **${quantity}**`
            )
            .setColor(0xff0000)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Calculate total price
    const fishData = FISH[fishName];
    const totalPrice = fishData.price * quantity;
    
    // Remove fish from inventory
    await removeFish(userId, guildId, fishName, quantity);
    
    // Add money
    const newBalance = await addMoney(userId, guildId, totalPrice, 'fish_sale', `Vendu ${quantity}x ${fishName}`);
    
    // Create embed
    const embed = new EmbedBuilder()
        .setTitle('💰 Vente réussie !')
        .setDescription(
            `**${message.author.username}**, vous avez vendu **${quantity}** ${fishData.emoji} **${fishName}** !\n\n` +
            `💰 Revenus: **${totalPrice.toLocaleString()}** coins\n` +
            `💵 Nouveau solde: **${newBalance.toLocaleString()}** coins`
        )
        .setColor(RARITY_COLORS[fishData.rarity])
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Inventory command - Show fish inventory
 */
export async function inventoryCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const inventory = await getFishInventory(userId, guildId);
    const fishEntries = Object.entries(inventory);
    
    if (fishEntries.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('📦 Inventaire de pêche')
            .setDescription(`**${message.author.username}**, votre inventaire est vide !\n\nUtilisez \`$fish\` pour pêcher.`)
            .setColor(0x808080)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Calculate total value
    let totalValue = 0;
    const fishList = [];
    
    for (const [fishName, quantity] of fishEntries) {
        if (FISH[fishName]) {
            const fishData = FISH[fishName];
            const value = fishData.price * quantity;
            totalValue += value;
            
            fishList.push({
                name: fishName,
                quantity,
                price: fishData.price,
                totalValue: value,
                emoji: fishData.emoji,
                rarity: fishData.rarity
            });
        }
    }
    
    // Sort by rarity (mythic > legendary > epic > rare > uncommon > common)
    const rarityOrder = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
    fishList.sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity]);
    
    // Create description with fish list
    let description = `**${message.author.username}**, voici votre inventaire de pêche :\n\n`;
    
    // Group by rarity
    const byRarity = {};
    for (const fish of fishList) {
        if (!byRarity[fish.rarity]) {
            byRarity[fish.rarity] = [];
        }
        byRarity[fish.rarity].push(fish);
    }
    
    for (const rarity of ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']) {
        if (byRarity[rarity]) {
            description += `**${RARITY_NAMES[rarity]}:**\n`;
            for (const fish of byRarity[rarity]) {
                description += `${fish.emoji} **${fish.name}** x${fish.quantity} - ${fish.totalValue.toLocaleString()} coins\n`;
            }
            description += '\n';
        }
    }
    
    description += `\n💰 **Valeur totale:** ${totalValue.toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setTitle('📦 Inventaire de pêche')
        .setDescription(description)
        .setColor(0x3498db)
        .setFooter({ text: 'Utilisez $sellfish [nom] [quantité] pour vendre vos poissons' })
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Achievements command - Show user achievements
 */
export async function achievementsCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const achievements = await getUserAchievements(userId, guildId);
    const collectionCheck = await checkCollectionComplete(userId, guildId, FISH);
    const hasCollection = await hasCollectionAchievement(userId, guildId);
    
    // Count fish by rarity from permanent collection (not inventory)
    const collection = await getFishCollection(userId, guildId);
    const fishByRarity = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0
    };
    
    // Count collected fish by rarity (from permanent collection)
    Object.keys(collection).forEach((fishName) => {
        if (collection[fishName] === true && FISH[fishName]) {
            fishByRarity[FISH[fishName].rarity] = (fishByRarity[FISH[fishName].rarity] || 0) + 1;
        }
    });
    
    // Count total fish types by rarity
    const totalByRarity = {
        common: Object.values(FISH).filter(f => f.rarity === 'common').length,
        uncommon: Object.values(FISH).filter(f => f.rarity === 'uncommon').length,
        rare: Object.values(FISH).filter(f => f.rarity === 'rare').length,
        epic: Object.values(FISH).filter(f => f.rarity === 'epic').length,
        legendary: Object.values(FISH).filter(f => f.rarity === 'legendary').length,
        mythic: Object.values(FISH).filter(f => f.rarity === 'mythic').length
    };
    
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Achievements de ${message.author.username}`,
            iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setColor(hasCollection ? 0xffd700 : 0x5865F2)
        .setTitle('🏆 Achievements de Pêche')
        .addFields(
            {
                name: '📚 Collection Complète',
                value: hasCollection 
                    ? '✅ **COMPLÉTÉE !**\n👑 Rôle: **Maître Pêcheur**\n🎉 Vous avez collectionné tous les 64 poissons !'
                    : `📊 **${collectionCheck.collected}/${collectionCheck.total}** poissons collectionnés\n⏳ ${collectionCheck.total - collectionCheck.collected} poissons restants`,
                inline: false
            },
            {
                name: '📈 Progression par Rareté',
                value: [
                    `🐟 **Commun:** ${fishByRarity.common}/${totalByRarity.common}`,
                    `🐠 **Peu Commun:** ${fishByRarity.uncommon}/${totalByRarity.uncommon}`,
                    `🦈 **Rare:** ${fishByRarity.rare}/${totalByRarity.rare}`,
                    `🌙 **Épique:** ${fishByRarity.epic}/${totalByRarity.epic}`,
                    `✨ **Légendaire:** ${fishByRarity.legendary}/${totalByRarity.legendary}`,
                    `⭐ **Mythique:** ${fishByRarity.mythic}/${totalByRarity.mythic}`
                ].join('\n'),
                inline: true
            }
        )
        .setFooter({ text: 'Continuez à pêcher pour débloquer tous les achievements !' })
        .setTimestamp();
    
    // Add missing fish list if collection not complete
    if (!hasCollection && collectionCheck.missing.length > 0 && collectionCheck.missing.length <= 20) {
        const missingList = collectionCheck.missing
            .slice(0, 20)
            .map(name => {
                const fish = FISH[name];
                return `${fish?.emoji || '❓'} ${name}`;
            })
            .join('\n');
        
        embed.addFields({
            name: `❌ Poissons Manquants (${collectionCheck.missing.length})`,
            value: missingList + (collectionCheck.missing.length > 20 ? '\n*... et plus*' : ''),
            inline: false
        });
    }
    
    await message.reply({ embeds: [embed] });
}
