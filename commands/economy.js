import {
    getBalance,
    addMoney,
    removeMoney,
    transferMoney,
    claimDaily,
    getTopUsers,
    setBalance,
    canWork,
    updateLastWork,
    getUser,
    getUserStats,
    canClaimDaily,
    canFish,
    getFishInventory,
    getFishCollection,
    checkCollectionComplete,
    hasCollectionAchievement,
    getUserAchievements,
    hardResetUser
} from '../database.js';
import { EmbedBuilder } from 'discord.js';
import { FISH, RARITY_NAMES } from './fishing.js';

/**
 * Balance command - Check user's balance
 */
export async function balanceCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const balance = await getBalance(userId, guildId);
    
    const embed = new EmbedBuilder()
        .setTitle('💰 Solde')
        .setDescription(`**${message.author.username}**, vous avez **${balance.toLocaleString()}** coins !`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Daily command - Claim daily reward
 */
export async function dailyCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const result = await claimDaily(userId, guildId, 500);
    
    const embed = new EmbedBuilder()
        .setTitle(result.success ? '🎁 Récompense Quotidienne Réclamée !' : '⏰ Récompense Quotidienne')
        .setDescription(result.message)
        .setColor(result.success ? 0x00ff00 : 0xff0000)
        .setTimestamp();
    
    // Add streak info to footer if available
    if (result.streak !== undefined) {
        if (result.success && result.streak > 0) {
            embed.setFooter({ text: `🔥 Streak: ${result.streak} jour${result.streak > 1 ? 's' : ''} consécutif${result.streak > 1 ? 's' : ''}` });
        } else if (!result.success) {
            embed.setFooter({ text: `📊 Streak actuel: ${result.streak} jour${result.streak > 1 ? 's' : ''}` });
        }
    }
    
    await message.reply({ embeds: [embed] });
}

/**
 * Work command - Earn money by working (5 hour cooldown)
 */
export async function workCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!(await canWork(userId, guildId))) {
        const user = await getUser(userId, guildId);
        const lastWork = new Date(user.last_work);
        const nextWork = new Date(lastWork.getTime() + 5 * 60 * 60 * 1000);
        const hoursLeft = ((nextWork - new Date()) / (1000 * 60 * 60)).toFixed(1);
        
        const embed = new EmbedBuilder()
            .setTitle('⏰ Temps d\'attente')
            .setDescription(`Vous avez déjà travaillé récemment ! Revenez dans **${hoursLeft}** heures.`)
            .setColor(0xff0000)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Random reward between 100-500 coins
    const reward = Math.floor(Math.random() * 401) + 100;
    const newBalance = await addMoney(userId, guildId, reward, 'work', 'Worked hard');
    await updateLastWork(userId, guildId);
    
    const embed = new EmbedBuilder()
        .setTitle('💼 Travail Terminé !')
        .setDescription(`Vous avez travaillé dur et gagné **${reward.toLocaleString()}** coins !\nVotre nouveau solde est de **${newBalance.toLocaleString()}** coins.\n\n⏰ Prochain travail disponible dans 5 heures.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Give command - Give money to another user
 * Usage: $give @user <amount>
 */
export async function giveCommand(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length < 2) {
        await message.reply('❌ Utilisation : `$give @user <montant>`');
        return;
    }
    
    // Parse user mention
    const userMatch = args[0].match(/^<@!?(\d+)>$/);
    if (!userMatch) {
        await message.reply('❌ Veuillez mentionner un utilisateur valide ! Utilisation : `$give @user <montant>`');
        return;
    }
    
    const targetUserId = userMatch[1];
    const targetUser = await message.guild.members.fetch(targetUserId).catch(() => null);
    
    if (!targetUser) {
        await message.reply('❌ Utilisateur introuvable !');
        return;
    }
    
    if (targetUser.user.bot) {
        await message.reply('❌ Vous ne pouvez pas donner de l\'argent aux bots !');
        return;
    }
    
    if (targetUserId === userId) {
        await message.reply('❌ Vous ne pouvez pas vous donner de l\'argent à vous-même !');
        return;
    }
    
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
        await message.reply('❌ Veuillez fournir un montant valide supérieur à 0 !');
        return;
    }
    
    const success = await transferMoney(userId, targetUserId, guildId, amount);
    
    if (!success) {
        const balance = await getBalance(userId, guildId);
        await message.reply(`❌ Fonds insuffisants ! Vous avez **${balance.toLocaleString()}** coins.`);
        return;
    }
    
    const balance = await getBalance(userId, guildId);
    const embed = new EmbedBuilder()
        .setTitle('💸 Argent Transféré !')
        .setDescription(`Vous avez donné **${amount.toLocaleString()}** coins à ${targetUser.user.username} !\nVotre nouveau solde est de **${balance.toLocaleString()}** coins.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Leaderboard command - Show top users by balance
 */
export async function leaderboardCommand(message) {
    const guildId = message.guild.id;
    const topUsers = await getTopUsers(guildId, 10);
    
    if (topUsers.length === 0) {
        await message.reply('❌ Aucun utilisateur trouvé dans le système d\'économie !');
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🏆 Classement Économique')
        .setDescription(
            topUsers.map((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                return `${medal} <@${user.user_id}> - **${user.balance.toLocaleString()}** coins`;
            }).join('\n')
        )
        .setColor(0xffd700)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Admin: Set balance command
 * Usage: $setbalance @user <amount>
 */
export async function setBalanceCommand(message, args) {
    // Restrict command to specific user ID only
    const AUTHORIZED_USER_ID = '581419256621826089';
    
    if (message.author.id !== AUTHORIZED_USER_ID) {
        await message.reply('❌ Cette commande est réservée au propriétaire du bot uniquement.');
        return;
    }
    
    if (args.length < 2) {
        await message.reply('❌ Utilisation : `$setbalance @user <montant>`');
        return;
    }
    
    // Parse user mention
    const userMatch = args[0].match(/^<@!?(\d+)>$/);
    if (!userMatch) {
        await message.reply('❌ Veuillez mentionner un utilisateur valide ! Utilisation : `$setbalance @user <montant>`');
        return;
    }
    
    const targetUserId = userMatch[1];
    const targetUser = await message.guild.members.fetch(targetUserId).catch(() => null);
    
    if (!targetUser) {
        await message.reply('❌ Utilisateur introuvable !');
        return;
    }
    
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 0) {
        await message.reply('❌ Veuillez fournir un montant valide (0 ou supérieur) !');
        return;
    }
    
    const guildId = message.guild.id;
    await setBalance(targetUserId, guildId, amount);
    
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Solde Défini')
        .setDescription(`Le solde de ${targetUser.user.username} a été défini à **${amount.toLocaleString()}** coins.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Admin: Add money command
 * Usage: $addmoney @user <amount>
 */
export async function addMoneyCommand(message, args) {
    // Restrict command to specific user ID only
    const AUTHORIZED_USER_ID = '581419256621826089';
    
    if (message.author.id !== AUTHORIZED_USER_ID) {
        await message.reply('❌ Cette commande est réservée au propriétaire du bot uniquement.');
        return;
    }
    
    if (args.length < 2) {
        await message.reply('❌ Utilisation : `$addmoney @user <montant>`');
        return;
    }
    
    // Parse user mention
    const userMatch = args[0].match(/^<@!?(\d+)>$/);
    if (!userMatch) {
        await message.reply('❌ Veuillez mentionner un utilisateur valide ! Utilisation : `$addmoney @user <montant>`');
        return;
    }
    
    const targetUserId = userMatch[1];
    const targetUser = await message.guild.members.fetch(targetUserId).catch(() => null);
    
    if (!targetUser) {
        await message.reply('❌ Utilisateur introuvable !');
        return;
    }
    
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
        await message.reply('❌ Veuillez fournir un montant valide supérieur à 0 !');
        return;
    }
    
    const guildId = message.guild.id;
    const newBalance = await addMoney(targetUserId, guildId, amount, 'admin', `Admin a ajouté ${amount} coins`);
    
    const embed = new EmbedBuilder()
        .setTitle('➕ Argent Ajouté')
        .setDescription(`**${amount.toLocaleString()}** coins ont été ajoutés à ${targetUser.user.username} !\nNouveau solde : **${newBalance.toLocaleString()}** coins.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Hard reset command - Reset all user data to default (OWNER ONLY)
 * Usage: $hardreset @user
 */
export async function hardResetCommand(message, args) {
    // Restrict command to specific user ID only
    const AUTHORIZED_USER_ID = '581419256621826089';
    
    if (message.author.id !== AUTHORIZED_USER_ID) {
        await message.reply('❌ Cette commande est réservée au propriétaire du bot uniquement.');
        return;
    }
    
    if (args.length < 1) {
        await message.reply('❌ Utilisation : `$hardreset @user`\n⚠️ **ATTENTION:** Cette commande réinitialise TOUTES les données de l\'utilisateur (balance, inventaire, achievements, transactions, etc.)');
        return;
    }
    
    // Parse user mention
    const userMatch = args[0].match(/^<@!?(\d+)>$/);
    if (!userMatch) {
        await message.reply('❌ Veuillez mentionner un utilisateur valide ! Utilisation : `$hardreset @user`');
        return;
    }
    
    const targetUserId = userMatch[1];
    const targetUser = await message.guild.members.fetch(targetUserId).catch(() => null);
    
    if (!targetUser) {
        await message.reply('❌ Utilisateur introuvable !');
        return;
    }
    
    if (targetUser.user.bot) {
        await message.reply('❌ Vous ne pouvez pas réinitialiser les données d\'un bot !');
        return;
    }
    
    const guildId = message.guild.id;
    
    // Perform the reset
    const result = await hardResetUser(targetUserId, guildId);
    
    if (result.success) {
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Réinitialisation Complète')
            .setDescription(
                `Toutes les données de **${targetUser.user.username}** ont été réinitialisées avec succès.\n\n` +
                `✅ Solde réinitialisé à **1000 coins**\n` +
                `✅ Inventaire vidé\n` +
                `✅ Collection vidée\n` +
                `✅ Achievements réinitialisés\n` +
                `✅ Transactions supprimées\n` +
                `✅ Cooldowns réinitialisés\n` +
                `✅ Streak daily réinitialisé\n\n` +
                `**L'utilisateur repart de zéro.**`
            )
            .setColor(0x00ff00)
            .setTimestamp();
        
        await message.reply({ embeds: [successEmbed] });
    } else {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Erreur de Réinitialisation')
            .setDescription(`Une erreur est survenue : ${result.message}`)
            .setColor(0xff0000)
            .setTimestamp();
        
        await message.reply({ embeds: [errorEmbed] });
    }
}

/**
 * Profile command - Show user profile with statistics
 */
export async function profileCommand(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const stats = await getUserStats(userId, guildId);
    const user = stats.user;
    
    // Calculate fish inventory value
    let inventoryValue = 0;
    const inventory = await getFishInventory(userId, guildId);
    const fishEntries = Object.entries(inventory);
    
    for (const [fishName, quantity] of fishEntries) {
        if (FISH[fishName]) {
            inventoryValue += FISH[fishName].price * quantity;
        }
    }
    
    // Calculate total wealth (balance + inventory value)
    const totalWealth = stats.balance + inventoryValue;
    
    // Get cooldown status
    const dailyAvailable = await canClaimDaily(userId, guildId);
    const workAvailable = await canWork(userId, guildId);
    const fishCheck = await canFish(userId, guildId);
    const fishAvailable = fishCheck.canFish;
    
    // Check collection achievement progress
    const collectionCheck = await checkCollectionComplete(userId, guildId, FISH);
    const hasCollection = await hasCollectionAchievement(userId, guildId);
    const collectionProgress = collectionCheck.total > 0 
        ? Math.round((collectionCheck.collected / collectionCheck.total) * 100) 
        : 0;
    
    // Create progress bar (20 characters)
    const progressBarLength = 20;
    const filledLength = Math.round((collectionCheck.collected / collectionCheck.total) * progressBarLength);
    const emptyLength = progressBarLength - filledLength;
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    
    // Format Discord account creation date
    const createdDate = message.author.createdAt
        ? message.author.createdAt.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
        : 'Inconnue';
    
    // Get member join date
    let joinedDate = 'Inconnue';
    let daysSinceJoin = 0;
    try {
        const member = await message.guild.members.fetch(userId);
        if (member.joinedAt) {
            joinedDate = member.joinedAt.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            daysSinceJoin = Math.floor((new Date() - member.joinedAt) / (1000 * 60 * 60 * 24));
        }
    } catch (error) {
        // Member might not be in cache, ignore error
        console.log(`Could not fetch member ${userId} for join date`);
    }
    
    // Get user avatar
    const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
    
    // Create embed
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Profil de ${message.author.username}`,
            iconURL: avatarURL
        })
        .setThumbnail(avatarURL)
        .setColor(0x5865F2) // Discord blurple color
        .addFields(
            {
                name: '💰 Économie',
                value: [
                    `💵 **Solde:** ${stats.balance.toLocaleString()} coins`,
                    `📊 **Total gagné:** ${stats.totalEarned.toLocaleString()} coins`,
                    `💸 **Total dépensé:** ${stats.totalSpent.toLocaleString()} coins`,
                    `💎 **Valeur totale:** ${totalWealth.toLocaleString()} coins`
                ].join('\n'),
                inline: true
            },
            {
                name: '📈 Statistiques',
                value: [
                    `📝 **Transactions:** ${stats.transactionCount}`,
                    `🎣 **Poissons pêchés:** ${stats.totalFish}`,
                    `🐟 **Types de poissons:** ${stats.uniqueFishTypes}`,
                    `📦 **Valeur inventaire:** ${inventoryValue.toLocaleString()} coins`
                ].join('\n'),
                inline: true
            },
            {
                name: '⏰ Cooldowns',
                value: [
                    dailyAvailable ? '✅ **Daily:** Disponible' : '⏳ **Daily:** En attente',
                    workAvailable ? '✅ **Work:** Disponible' : '⏳ **Work:** En attente',
                    fishAvailable ? '✅ **Fish:** Disponible' : '⏳ **Fish:** En attente'
                ].join('\n'),
                inline: true
            }
        )
        .setFooter({ 
            text: `Page 1/3 • Compte créé le ${createdDate} • Rejoint le serveur le ${joinedDate} (${daysSinceJoin} jour${daysSinceJoin > 1 ? 's' : ''})` 
        })
        .setTimestamp();
    
    // Send message and add reactions for pagination
    const sentMessage = await message.reply({ embeds: [embed] });
    
    // Add reactions for navigation
    await sentMessage.react('🐟').catch(() => {}); // Go to fish inventory page
    await sentMessage.react('🏆').catch(() => {}); // Go to achievements page
    await sentMessage.react('◀️').catch(() => {}); // Go back to previous page
    
    // Store pagination data (will be accessed from index.js)
    // We'll use a global map or pass it through the client
    if (typeof global.profilePaginationMessages !== 'undefined') {
        global.profilePaginationMessages.set(sentMessage.id, {
            userId,
            guildId,
            currentPage: 1
        });
    }
    
    return sentMessage;
}

/**
 * Create achievements embed for profile pagination
 */
export async function createAchievementsEmbed(message, userId, guildId) {
    const achievements = await getUserAchievements(userId, guildId);
    const collectionCheck = await checkCollectionComplete(userId, guildId, FISH);
    const hasCollection = await hasCollectionAchievement(userId, guildId);
    
    // Count fish by rarity from permanent collection
    const collection = await getFishCollection(userId, guildId);
    const fishByRarity = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0
    };
    
    Object.keys(collection).forEach((fishName) => {
        if (collection[fishName] === true && FISH[fishName]) {
            fishByRarity[FISH[fishName].rarity] = (fishByRarity[FISH[fishName].rarity] || 0) + 1;
        }
    });
    
    const totalByRarity = {
        common: Object.values(FISH).filter(f => f.rarity === 'common').length,
        uncommon: Object.values(FISH).filter(f => f.rarity === 'uncommon').length,
        rare: Object.values(FISH).filter(f => f.rarity === 'rare').length,
        epic: Object.values(FISH).filter(f => f.rarity === 'epic').length,
        legendary: Object.values(FISH).filter(f => f.rarity === 'legendary').length,
        mythic: Object.values(FISH).filter(f => f.rarity === 'mythic').length
    };
    
    // Fetch the user from the guild
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const user = member?.user || message.author;
    const avatarURL = user.displayAvatarURL({ dynamic: true, size: 256 });
    
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Profil de ${user.username} - Achievements`,
            iconURL: avatarURL
        })
        .setThumbnail(avatarURL)
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
        .setFooter({ text: 'Page 3/3 • Utilisez ◀️ pour revenir' })
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
    
    return embed;
}

/**
 * Create fish inventory embed for profile pagination
 */
export async function createFishInventoryEmbed(message, userId, guildId) {
    const inventory = await getFishInventory(userId, guildId);
    const fishEntries = Object.entries(inventory);
    
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const avatarURL = member?.user.displayAvatarURL({ dynamic: true, size: 256 }) || message.author.displayAvatarURL({ dynamic: true, size: 256 });
    
    if (fishEntries.length === 0) {
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `Profil de ${member?.user.username || message.author.username} - Inventaire`,
                iconURL: avatarURL
            })
            .setThumbnail(avatarURL)
            .setTitle('📦 Inventaire de Pêche')
            .setDescription(`**${member?.user.username || message.author.username}**, votre inventaire est vide !\n\nUtilisez \`$fish\` pour pêcher.`)
            .setColor(0x808080)
            .setFooter({ text: 'Page 2/3 • Utilisez ◀️ pour revenir au profil' })
            .setTimestamp();
        
        return embed;
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
    let description = `**${member?.user.username || message.author.username}**, voici votre inventaire de pêche :\n\n`;
    
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
        .setAuthor({
            name: `Profil de ${member?.user.username || message.author.username} - Inventaire`,
            iconURL: avatarURL
        })
        .setThumbnail(avatarURL)
        .setTitle('📦 Inventaire de Pêche')
        .setDescription(description)
        .setColor(0x3498db)
        .setFooter({ text: 'Page 2/3 • Utilisez ◀️ pour revenir au profil • Utilisez $sellfish [nom] [quantité] pour vendre' })
        .setTimestamp();
    
    return embed;
}

/**
 * Rebuild profile embed (used for pagination)
 */
export async function rebuildProfileEmbed(message, userId, guildId) {
    const stats = await getUserStats(userId, guildId);
    const inventory = await getFishInventory(userId, guildId);
    const fishEntries = Object.entries(inventory);
    
    let inventoryValue = 0;
    for (const [fishName, quantity] of fishEntries) {
        if (FISH[fishName]) {
            inventoryValue += FISH[fishName].price * quantity;
        }
    }
    
    const totalWealth = stats.balance + inventoryValue;
    const dailyAvailable = await canClaimDaily(userId, guildId);
    const workAvailable = await canWork(userId, guildId);
    const fishCheck = await canFish(userId, guildId);
    const fishAvailable = fishCheck.canFish;
    const collectionCheck = await checkCollectionComplete(userId, guildId, FISH);
    const hasCollection = await hasCollectionAchievement(userId, guildId);
    const collectionProgress = collectionCheck.total > 0 
        ? Math.round((collectionCheck.collected / collectionCheck.total) * 100) 
        : 0;
    
    const progressBarLength = 20;
    const filledLength = Math.round((collectionCheck.collected / collectionCheck.total) * progressBarLength);
    const emptyLength = progressBarLength - filledLength;
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const createdDate = member?.user.createdAt
        ? member.user.createdAt.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
        : 'Inconnue';
    
    let joinedDate = 'Inconnue';
    let daysSinceJoin = 0;
    if (member?.joinedAt) {
        joinedDate = member.joinedAt.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        daysSinceJoin = Math.floor((new Date() - member.joinedAt) / (1000 * 60 * 60 * 24));
    }
    
    const avatarURL = member?.user.displayAvatarURL({ dynamic: true, size: 256 }) || message.author.displayAvatarURL({ dynamic: true, size: 256 });
    
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Profil de ${member?.user.username || message.author.username}`,
            iconURL: avatarURL
        })
        .setThumbnail(avatarURL)
        .setColor(0x5865F2)
        .addFields(
            {
                name: '💰 Économie',
                value: [
                    `💵 **Solde:** ${stats.balance.toLocaleString()} coins`,
                    `📊 **Total gagné:** ${stats.totalEarned.toLocaleString()} coins`,
                    `💸 **Total dépensé:** ${stats.totalSpent.toLocaleString()} coins`,
                    `💎 **Valeur totale:** ${totalWealth.toLocaleString()} coins`
                ].join('\n'),
                inline: true
            },
            {
                name: '📈 Statistiques',
                value: [
                    `📝 **Transactions:** ${stats.transactionCount}`,
                    `🎣 **Poissons pêchés:** ${stats.totalFish}`,
                    `🐟 **Types de poissons:** ${stats.uniqueFishTypes}`,
                    `📦 **Valeur inventaire:** ${inventoryValue.toLocaleString()} coins`
                ].join('\n'),
                inline: true
            },
            {
                name: '⏰ Cooldowns',
                value: [
                    dailyAvailable ? '✅ **Daily:** Disponible' : '⏳ **Daily:** En attente',
                    workAvailable ? '✅ **Work:** Disponible' : '⏳ **Work:** En attente',
                    fishAvailable ? '✅ **Fish:** Disponible' : '⏳ **Fish:** En attente'
                ].join('\n'),
                inline: true
            }
        )
        .setFooter({ 
            text: `Page 1/3 • Compte créé le ${createdDate} • Rejoint le serveur le ${joinedDate} (${daysSinceJoin} jour${daysSinceJoin > 1 ? 's' : ''})` 
        })
        .setTimestamp();
    
    return embed;
}

/**
 * Help command - Show available commands
 */
// Help categories definition
const HELP_CATEGORIES = {
    general: {
        name: '📋 Général',
        emoji: '📋',
        color: 0x5865F2,
        description: 'Commandes générales et informations',
        commands: [
            '`$help [catégorie]` - Afficher l\'aide (catégories: general, economie, peche, jeux, casino, musique, pokemon, admin)',
            '`$profile` ou `$p` - Voir votre profil complet',
            '`$leaderboard` ou `$lb` - Top 10 des plus riches',
            '`$say <message>` - Faire parler le bot'
        ]
    },
    economie: {
        name: '💰 Économie',
        emoji: '💰',
        color: 0xF1C40F,
        description: 'Gagnez et gérez vos coins',
        commands: [
            '`$balance` ou `$bal` - Vérifier votre solde',
            '`$daily` - Récompense quotidienne (500 coins, reset à minuit)',
            '`$work` - Travailler (100-500 coins, cooldown 5h)',
            '`$give @user <montant>` - Donner des coins',
            '',
            '**🎤 Récompenses Vocales**',
            'Restez en vocal 30+ min → **50 coins/30min** (max 4h = 400 coins)'
        ]
    },
    peche: {
        name: '🎣 Pêche',
        emoji: '🎣',
        color: 0x3498DB,
        description: 'Attrapez des poissons et vendez-les',
        commands: [
            '`$fish` ou `$peche` - Aller pêcher (cooldown 1h)',
            '`$inventory` ou `$inv` - Voir vos poissons',
            '`$sellfish [nom] [qté]` - Vendre vos poissons',
            '`$sellall` - Vendre tous vos poissons',
            '`$fishstats` - Voir vos statistiques de pêche',
            '`$fishtypes` - Liste des poissons et leur rareté',
            '`$achievements` - Voir vos succès de pêche'
        ]
    },
    jeux: {
        name: '🎮 Jeux',
        emoji: '🎮',
        color: 0xE91E63,
        description: 'Mini-jeux et divertissement',
        commands: [
            '`$roll` - Lancer une pièce (pile ou face)',
            '`$pfc [@user]` - Pierre-Feuille-Ciseaux',
            '`$faaahhh` ou `$fah` - Jouer un son en vocal',
            '`$soundboard` - Liste des sons disponibles'
        ]
    },
    casino: {
        name: '🎰 Casino',
        emoji: '🎰',
        color: 0x9B59B6,
        description: 'Jeux de hasard et de chance!',
        commands: [
            '**🎮 Jeux:**',
            '`$casino` - Voir tous les jeux',
            '`$slots <montant>` - Machine à sous',
            '`$wheel <montant>` - Roue de la fortune',
            '`$coinflip <montant>` - Pile ou face',
            '`$duel @joueur <montant>` - 8 mini-jeux VS!',
            '`$bowser <montant>` - Zone Danger (risqué!)',
            '`$allin` - Miser TOUT au slots!',
            '',
            '**🎮 Mini-jeux Duel (9 jeux):**',
            '🎲 Dés • 🏇 Course • 🃏 Cartes • ✊ Shifumi',
            '⚡ Réflexes • 🎰 Slots • 🔢 Nombre • 💣 Bombe • 🧮 Calcul'
        ]
    },
    musique: {
        name: '🎵 Musique',
        emoji: '🎵',
        color: 0x1DB954,
        description: 'Écoutez de la musique en vocal',
        commands: [
            '**Lecture:**',
            '`$play <url/recherche>` ou `$p` - Jouer une musique',
            '`$pause` - Mettre en pause',
            '`$resume` - Reprendre la lecture',
            '`$skip` ou `$next` - Passer à la suivante',
            '`$stop` - Arrêter et vider la queue',
            '',
            '**File d\'attente:**',
            '`$queue` ou `$q` - Voir la file d\'attente',
            '`$nowplaying` ou `$np` - Musique en cours',
            '`$remove <position>` - Retirer une musique',
            '`$clear` - Vider la file d\'attente',
            '',
            '**Contrôles:**',
            '`$volume <0-100>` ou `$vol` - Régler le volume',
            '`$loop` - Activer/désactiver la boucle',
            '`$shuffle` - Mélanger la queue',
            '`$seek <secondes>` - Aller à un moment précis',
            '`$leave` ou `$disconnect` - Quitter le vocal',
            '',
            '**Text-to-Speech:**',
            '`$tts <texte>` - Faire parler le bot',
            '`$tts -en Hello` - TTS en anglais',
            '`$tts -fr Bonjour` - TTS en français'
        ]
    },
    pokemon: {
        name: '🐾 Pokémon',
        emoji: '🐾',
        color: 0xFFCB05,
        description: 'Attrapez-les tous !',
        commands: [
            '**Capture:**',
            '`$catch` ou `$attraper` - Capturer un Pokémon (cooldown 15min)',
            '⚡ Les légendaires/fabuleux nécessitent un QTE rapide !',
            '',
            '**Collection:**',
            '`$pokedex [page]` ou `$dex` - Voir votre Pokédex',
            '`$pc [page]` ou `$box` - Voir tous vos Pokémon',
            '',
            '**Informations:**',
            '`$pokemon <nom/numéro>` - Infos sur un Pokémon',
            '• Recherche en français ou anglais',
            '• Exemple: `$pokemon dracaufeu` ou `$pokemon 6`',
            '',
            '**Test (dev):**',
            '`$testlegendary` - Tester le système QTE'
        ]
    },
    admin: {
        name: '⚙️ Administration',
        emoji: '⚙️',
        color: 0xE74C3C,
        description: 'Commandes réservées aux admins',
        commands: [
            '`$setbalance @user <montant>` - Définir le solde',
            '`$addmoney @user <montant>` - Ajouter des coins',
            '`$removemoney @user <montant>` - Retirer des coins'
        ]
    }
};

// Aliases for category names
const CATEGORY_ALIASES = {
    'général': 'general', 'general': 'general', 'gen': 'general',
    'économie': 'economie', 'economie': 'economie', 'eco': 'economie', 'money': 'economie',
    'pêche': 'peche', 'peche': 'peche', 'fish': 'peche', 'fishing': 'peche',
    'jeux': 'jeux', 'games': 'jeux', 'game': 'jeux', 'fun': 'jeux',
    'casino': 'casino', 'slot': 'casino', 'slots': 'casino', 'gamble': 'casino',
    'musique': 'musique', 'music': 'musique', 'song': 'musique', 'songs': 'musique',
    'pokémon': 'pokemon', 'pokemon': 'pokemon', 'poke': 'pokemon', 'pk': 'pokemon',
    'admin': 'admin', 'administration': 'admin', 'mod': 'admin'
};

// Emoji to category mapping for reactions
const EMOJI_TO_CATEGORY = {
    '📋': 'general',
    '💰': 'economie',
    '🎣': 'peche',
    '🎮': 'jeux',
    '🎰': 'casino',
    '🎵': 'musique',
    '🐾': 'pokemon',
    '⚙️': 'admin',
    '🏠': 'home'
};

// Category order for reactions
const CATEGORY_ORDER = ['📋', '💰', '🎣', '🎮', '🎰', '🎵', '🐾', '⚙️'];

/**
 * Create the main help menu embed
 */
function createMainHelpEmbed() {
    return new EmbedBuilder()
        .setTitle('📚 Aide du Bot')
        .setDescription(
            '**Réagissez avec un emoji pour voir une catégorie !**\n\n' +
            '📋 Général • 💰 Économie • 🎣 Pêche • 🎮 Jeux\n' +
            '🎰 Casino • 🎵 Musique • 🐾 Pokémon • ⚙️ Admin\n\n' +
            '*Ou utilisez `$help <catégorie>`*'
        )
        .addFields(
            Object.entries(HELP_CATEGORIES).map(([key, category]) => ({
                name: category.name,
                value: category.description,
                inline: true
            }))
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Préfixe: $ • Réagissez pour naviguer • 🏠 = Menu principal' })
        .setTimestamp();
}

/**
 * Create a category embed
 */
function createCategoryEmbed(categoryKey) {
    const category = HELP_CATEGORIES[categoryKey];
    if (!category) return null;
    
    return new EmbedBuilder()
        .setTitle(`${category.name}`)
        .setDescription(`${category.description}\n\n${category.commands.join('\n')}`)
        .setColor(category.color)
        .setFooter({ text: 'Réagissez 🏠 pour revenir au menu principal' })
        .setTimestamp();
}

// Store active help messages for reaction handling
const activeHelpMessages = new Map();

export async function helpCommand(message, args = []) {
    const categoryArg = args[0]?.toLowerCase();
    
    // If a category is specified, show that category directly (no reactions)
    if (categoryArg) {
        const categoryKey = CATEGORY_ALIASES[categoryArg];
        
        if (categoryKey && HELP_CATEGORIES[categoryKey]) {
            const embed = createCategoryEmbed(categoryKey);
            return message.reply({ embeds: [embed] });
        } else {
            return message.reply(`❌ Catégorie inconnue: \`${categoryArg}\`\n\n**Catégories disponibles:** general, economie, peche, jeux, casino, musique, pokemon, admin`);
        }
    }
    
    // Show main help menu with reactions
    const embed = createMainHelpEmbed();
    const helpMsg = await message.reply({ embeds: [embed] });
    
    // Add reactions
    try {
        for (const emoji of CATEGORY_ORDER) {
            await helpMsg.react(emoji);
        }
        await helpMsg.react('🏠');
    } catch (error) {
        console.error('Error adding reactions:', error);
    }
    
    // Store message info for reaction handling
    activeHelpMessages.set(helpMsg.id, {
        odiserId: message.author.id,
        currentView: 'home',
        createdAt: Date.now()
    });
    
    // Create reaction collector
    const filter = (reaction, user) => {
        return !user.bot && 
               (CATEGORY_ORDER.includes(reaction.emoji.name) || reaction.emoji.name === '🏠');
    };
    
    const collector = helpMsg.createReactionCollector({ 
        filter, 
        time: 120000 // 2 minutes
    });
    
    collector.on('collect', async (reaction, user) => {
        // Remove user's reaction
        try {
            await reaction.users.remove(user.id);
        } catch (error) {
            // Ignore if we can't remove reaction
        }
        
        const emoji = reaction.emoji.name;
        const categoryKey = EMOJI_TO_CATEGORY[emoji];
        
        if (!categoryKey) return;
        
        let newEmbed;
        if (categoryKey === 'home') {
            newEmbed = createMainHelpEmbed();
        } else {
            newEmbed = createCategoryEmbed(categoryKey);
        }
        
        if (newEmbed) {
            try {
                await helpMsg.edit({ embeds: [newEmbed] });
            } catch (error) {
                console.error('Error updating help message:', error);
            }
        }
    });
    
    collector.on('end', async () => {
        // Remove from active messages
        activeHelpMessages.delete(helpMsg.id);
        
        // Update embed to show it's no longer interactive
        try {
            const finalEmbed = createMainHelpEmbed()
                .setFooter({ text: 'Ce menu a expiré. Utilisez $help pour un nouveau menu.' });
            await helpMsg.edit({ embeds: [finalEmbed] });
            await helpMsg.reactions.removeAll();
        } catch (error) {
            // Ignore if message was deleted
        }
    });
}
