import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize database with default structure
const adapter = new JSONFile(join(__dirname, 'economy.json'));
const db = new Low(adapter, {
    users: [],
    transactions: []
});

// Initialize database
await db.read();

/**
 * Get or create a user in the database
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Object} User object
 */
export function getUser(userId, guildId) {
    const user = db.data.users.find(u => u.user_id === userId && u.guild_id === guildId);
    
    if (!user) {
        const newUser = {
            user_id: userId,
            guild_id: guildId,
            balance: 1000,
            last_daily: null,
            last_work: null,
            voice_join_time: null,
            last_voice_reward: null,
            created_at: new Date().toISOString()
        };
        db.data.users.push(newUser);
        db.write();
        return newUser;
    }
    
    // Ensure new fields exist for existing users
    if (user.last_work === undefined) user.last_work = null;
    if (user.voice_join_time === undefined) user.voice_join_time = null;
    if (user.last_voice_reward === undefined) user.last_voice_reward = null;
    if (user.last_fish === undefined) user.last_fish = null;
    if (user.fish_inventory === undefined) user.fish_inventory = {};
    if (user.fish_collection === undefined) user.fish_collection = {}; // Collection permanente des poissons pêchés
    if (user.achievements === undefined) user.achievements = {};
    if (user.has_collection_complete === undefined) user.has_collection_complete = false;
    
    return user;
}

/**
 * Get user balance
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {number} User balance
 */
export function getBalance(userId, guildId) {
    const user = getUser(userId, guildId);
    return user.balance;
}

/**
 * Add money to user's balance
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - Amount to add
 * @param {string} type - Transaction type (e.g., 'daily', 'work', 'gift')
 * @param {string} description - Optional description
 * @returns {number} New balance
 */
export function addMoney(userId, guildId, amount, type = 'other', description = null) {
    const user = getUser(userId, guildId);
    user.balance += amount;
    
    // Add transaction
    const transaction = {
        id: db.data.transactions.length + 1,
        user_id: userId,
        guild_id: guildId,
        amount: amount,
        type: type,
        description: description || `${type}: +${amount}`,
        created_at: new Date().toISOString()
    };
    db.data.transactions.push(transaction);
    
    db.write();
    return user.balance;
}

/**
 * Remove money from user's balance
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - Amount to remove
 * @param {string} type - Transaction type
 * @param {string} description - Optional description
 * @returns {number} New balance, or null if insufficient funds
 */
export function removeMoney(userId, guildId, amount, type = 'other', description = null) {
    const user = getUser(userId, guildId);
    
    if (user.balance < amount) {
        return null; // Insufficient funds
    }
    
    user.balance -= amount;
    
    // Add transaction
    const transaction = {
        id: db.data.transactions.length + 1,
        user_id: userId,
        guild_id: guildId,
        amount: -amount,
        type: type,
        description: description || `${type}: -${amount}`,
        created_at: new Date().toISOString()
    };
    db.data.transactions.push(transaction);
    
    db.write();
    return user.balance;
}

/**
 * Transfer money between users
 * @param {string} fromUserId - Sender user ID
 * @param {string} toUserId - Receiver user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - Amount to transfer
 * @returns {boolean} True if successful, false if insufficient funds
 */
export function transferMoney(fromUserId, toUserId, guildId, amount) {
    if (amount <= 0) {
        return false;
    }
    
    const fromUser = getUser(fromUserId, guildId);
    if (fromUser.balance < amount) {
        return false; // Insufficient funds
    }
    
    // Perform transfer
    fromUser.balance -= amount;
    const toUser = getUser(toUserId, guildId);
    toUser.balance += amount;
    
    // Add transactions
    const transaction1 = {
        id: db.data.transactions.length + 1,
        user_id: fromUserId,
        guild_id: guildId,
        amount: -amount,
        type: 'transfer',
        description: `Transfer to ${toUserId}`,
        created_at: new Date().toISOString()
    };
    
    const transaction2 = {
        id: db.data.transactions.length + 2,
        user_id: toUserId,
        guild_id: guildId,
        amount: amount,
        type: 'transfer',
        description: `Transfer from ${fromUserId}`,
        created_at: new Date().toISOString()
    };
    
    db.data.transactions.push(transaction1, transaction2);
    db.write();
    
    return true;
}

/**
 * Set user's balance to a specific amount
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - New balance amount
 */
export function setBalance(userId, guildId, amount) {
    const user = getUser(userId, guildId);
    user.balance = amount;
    db.write();
}

/**
 * Get current date in Paris timezone (YYYY-MM-DD format)
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getParisDate() {
    const now = new Date();
    return now.toLocaleDateString('en-CA', { 
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Get next midnight in Paris timezone
 * @returns {Date} Next midnight in Paris
 */
function getNextMidnightParis() {
    const now = new Date();
    const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const nextMidnight = new Date(parisTime);
    nextMidnight.setHours(24, 0, 0, 0); // Next midnight
    
    // Convert back to UTC
    const utcOffset = now.getTime() - parisTime.getTime();
    return new Date(nextMidnight.getTime() - utcOffset);
}

/**
 * Check if user can claim daily reward (resets at midnight Paris time)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {boolean} True if can claim, false otherwise
 */
export function canClaimDaily(userId, guildId) {
    const user = getUser(userId, guildId);
    
    if (!user.last_daily) {
        return true;
    }
    
    // Get dates in Paris timezone
    const lastDailyDate = new Date(user.last_daily).toLocaleDateString('en-CA', { 
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const currentDate = getParisDate();
    
    // Can claim if it's a different day
    return lastDailyDate !== currentDate;
}

/**
 * Claim daily reward (resets at midnight Paris time)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - Daily reward amount (default: 500)
 * @returns {Object} { success: boolean, balance: number, message: string }
 */
export function claimDaily(userId, guildId, amount = 500) {
    if (!canClaimDaily(userId, guildId)) {
        const user = getUser(userId, guildId);
        const nextMidnight = getNextMidnightParis();
        const now = new Date();
        const msUntilMidnight = nextMidnight - now;
        const hoursLeft = Math.floor(msUntilMidnight / (1000 * 60 * 60));
        const minutesLeft = Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeLeft = '';
        if (hoursLeft > 0) {
            timeLeft = `${hoursLeft} heure${hoursLeft > 1 ? 's' : ''} et ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}`;
        } else {
            timeLeft = `${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}`;
        }
        
        return {
            success: false,
            balance: user.balance,
            message: `Vous avez déjà réclamé votre récompense quotidienne aujourd'hui ! Revenez dans ${timeLeft}.`
        };
    }
    
    const user = getUser(userId, guildId);
    user.balance += amount;
    user.last_daily = new Date().toISOString();
    
    // Add transaction
    const transaction = {
        id: db.data.transactions.length + 1,
        user_id: userId,
        guild_id: guildId,
        amount: amount,
        type: 'daily',
        description: 'Daily reward',
        created_at: new Date().toISOString()
    };
    db.data.transactions.push(transaction);
    db.write();
    
    return {
        success: true,
        balance: user.balance,
        message: `Vous avez réclamé votre récompense quotidienne de **${amount.toLocaleString()}** coins ! Votre nouveau solde est de **${user.balance.toLocaleString()}** coins.`
    };
}

/**
 * Get top users by balance
 * @param {string} guildId - Discord guild ID
 * @param {number} limit - Number of users to return (default: 10)
 * @returns {Array} Array of user objects
 */
export function getTopUsers(guildId, limit = 10) {
    return db.data.users
        .filter(user => user.guild_id === guildId)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, limit)
        .map(user => ({
            user_id: user.user_id,
            balance: user.balance
        }));
}

/**
 * Check if user can work (5 hour cooldown)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {boolean} True if can work, false otherwise
 */
export function canWork(userId, guildId) {
    const user = getUser(userId, guildId);
    
    if (!user.last_work) {
        return true;
    }
    
    const lastWork = new Date(user.last_work);
    const now = new Date();
    const hoursSince = (now - lastWork) / (1000 * 60 * 60);
    
    return hoursSince >= 5;
}

/**
 * Update last work time
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 */
export function updateLastWork(userId, guildId) {
    const user = getUser(userId, guildId);
    user.last_work = new Date().toISOString();
    db.write();
}

/**
 * Set voice join time
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 */
export function setVoiceJoinTime(userId, guildId) {
    const user = getUser(userId, guildId);
    if (!user.voice_join_time) {
        user.voice_join_time = new Date().toISOString();
        db.write();
    }
}

/**
 * Clear voice join time
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 */
export function clearVoiceJoinTime(userId, guildId) {
    const user = getUser(userId, guildId);
    user.voice_join_time = null;
    user.last_voice_reward = null;
    db.write();
}

/**
 * Check and reward voice channel time (50 coins every 30 minutes after first 30 minutes)
 * Cap: Maximum 4 hours (8 rewards total: 30min, 60min, 90min, 120min, 150min, 180min, 210min, 240min)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Object} { rewarded: boolean, amount: number, balance: number } or null if not eligible
 */
export function checkVoiceReward(userId, guildId) {
    const user = getUser(userId, guildId);
    
    if (!user.voice_join_time) {
        return null; // Not in voice channel
    }
    
    const joinTime = new Date(user.voice_join_time);
    const now = new Date();
    const minutesInVoice = (now - joinTime) / (1000 * 60);
    
    // Cap: No rewards after 4 hours (240 minutes)
    if (minutesInVoice >= 240) {
        return null; // Reached 4-hour cap
    }
    
    // Must be in voice for at least 30 minutes
    if (minutesInVoice < 30) {
        return null;
    }
    
    // Check if we've already rewarded for this interval
    const lastReward = user.last_voice_reward ? new Date(user.last_voice_reward) : null;
    const minutesSinceLastReward = lastReward ? (now - lastReward) / (1000 * 60) : Infinity;
    
    // Reward if at least 30 minutes have passed since last reward
    if (minutesSinceLastReward >= 30) {
        // Double-check we haven't exceeded 4 hours before rewarding
        if (minutesInVoice >= 240) {
            return null; // Reached cap
        }
        
        const reward = 50;
        user.balance += reward;
        user.last_voice_reward = now.toISOString();
        
        // Add transaction
        const transaction = {
            id: db.data.transactions.length + 1,
            user_id: userId,
            guild_id: guildId,
            amount: reward,
            type: 'voice',
            description: 'Voice channel reward (30 minutes)',
            created_at: now.toISOString()
        };
        db.data.transactions.push(transaction);
        db.write();
        
        return {
            rewarded: true,
            amount: reward,
            balance: user.balance
        };
    }
    
    return null;
}

/**
 * Get current hour in Paris timezone (0-23)
 * @returns {number} Current hour (0-23)
 */
function getParisHour() {
    const now = new Date();
    return parseInt(now.toLocaleString('en-US', { 
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        hour12: false
    }));
}

/**
 * Get next hour in Paris timezone
 * @returns {Date} Next hour (e.g., if current is 14:30, returns 15:00)
 */
function getNextHourParis() {
    const now = new Date();
    
    // Get current time components in Paris timezone
    const parisMinute = parseInt(now.toLocaleString('en-US', { 
        timeZone: 'Europe/Paris',
        minute: '2-digit'
    }));
    const parisSecond = parseInt(now.toLocaleString('en-US', { 
        timeZone: 'Europe/Paris',
        second: '2-digit'
    }));
    const parisMs = now.getMilliseconds();
    
    // Calculate milliseconds until next hour starts in Paris timezone
    // Example: if it's 18:39:30.500, next hour is 19:00:00.000
    // Remaining: 20 minutes, 29 seconds, 500ms
    const minutesRemaining = 60 - parisMinute - 1; // Full minutes remaining (20 if at minute 39)
    const secondsInCurrentMinute = 60 - parisSecond - 1; // Seconds remaining in current minute (29 if at second 30)
    const msInCurrentSecond = 1000 - parisMs; // Milliseconds remaining in current second
    
    // Total milliseconds until next hour
    const totalMsUntilNextHour = (minutesRemaining * 60 * 1000) + (secondsInCurrentMinute * 1000) + msInCurrentSecond;
    
    return new Date(now.getTime() + totalMsUntilNextHour);
}

/**
 * Check if user can fish (resets at each hour in Paris time)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Object} { canFish: boolean, timeRemaining: number (seconds) }
 */
export function canFish(userId, guildId) {
    const user = getUser(userId, guildId);
    
    if (!user.last_fish) {
        return { canFish: true, timeRemaining: 0 };
    }
    
    // Get hours in Paris timezone
    const lastFishDate = new Date(user.last_fish);
    const lastFishHour = parseInt(lastFishDate.toLocaleString('en-US', { 
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        hour12: false
    }));
    const lastFishDateStr = lastFishDate.toLocaleDateString('en-CA', { 
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const currentHour = getParisHour();
    const currentDate = getParisDate();
    
    // Can fish if it's a different hour or different day
    if (lastFishDateStr !== currentDate || lastFishHour !== currentHour) {
        return { canFish: true, timeRemaining: 0 };
    }
    
    // Calculate time until next hour
    const nextHour = getNextHourParis();
    const now = new Date();
    const msUntilNextHour = nextHour - now;
    let timeRemaining = Math.ceil(msUntilNextHour / 1000); // seconds
    
    // Cap at 1 hour (3600 seconds) maximum to prevent incorrect calculations
    const MAX_COOLDOWN_SECONDS = 3600; // 1 hour
    if (timeRemaining > MAX_COOLDOWN_SECONDS) {
        timeRemaining = MAX_COOLDOWN_SECONDS;
    }
    
    return { canFish: false, timeRemaining };
}

/**
 * Update last fish time
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 */
export function updateLastFish(userId, guildId) {
    const user = getUser(userId, guildId);
    user.last_fish = new Date().toISOString();
    db.write();
}

/**
 * Add fish to user inventory
 * Also adds to permanent collection for achievements
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} fishName - Name of the fish
 * @param {number} quantity - Quantity to add (default 1)
 */
export function addFish(userId, guildId, fishName, quantity = 1) {
    const user = getUser(userId, guildId);
    
    // Add to inventory
    if (!user.fish_inventory) {
        user.fish_inventory = {};
    }
    if (!user.fish_inventory[fishName]) {
        user.fish_inventory[fishName] = 0;
    }
    user.fish_inventory[fishName] += quantity;
    
    // Add to permanent collection (for achievements) - only once per fish type
    if (!user.fish_collection) {
        user.fish_collection = {};
    }
    // Mark as collected if not already in collection
    if (!user.fish_collection[fishName]) {
        user.fish_collection[fishName] = true;
    }
    
    db.write();
}

/**
 * Get user fish inventory
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Fish inventory object
 */
export function getFishInventory(userId, guildId) {
    const user = getUser(userId, guildId);
    return user.fish_inventory || {};
}

/**
 * Get user fish collection (permanent - for achievements)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Fish collection object (fishName: true)
 */
export function getFishCollection(userId, guildId) {
    const user = getUser(userId, guildId);
    return user.fish_collection || {};
}

/**
 * Remove fish from user inventory
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} fishName - Name of the fish
 * @param {number} quantity - Quantity to remove
 * @returns {boolean} True if successful, false if insufficient quantity
 */
export function removeFish(userId, guildId, fishName, quantity = 1) {
    const user = getUser(userId, guildId);
    if (!user.fish_inventory || !user.fish_inventory[fishName]) {
        return false;
    }
    
    if (user.fish_inventory[fishName] < quantity) {
        return false;
    }
    
    user.fish_inventory[fishName] -= quantity;
    if (user.fish_inventory[fishName] === 0) {
        delete user.fish_inventory[fishName];
    }
    
    db.write();
    return true;
}

/**
 * Get user statistics
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Object} User statistics object
 */
export function getUserStats(userId, guildId) {
    const user = getUser(userId, guildId);
    const inventory = user.fish_inventory || {};
    
    // Get all transactions for this user
    const userTransactions = db.data.transactions.filter(
        t => t.user_id === userId && t.guild_id === guildId
    );
    
    // Calculate statistics
    const totalEarned = userTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalSpent = Math.abs(userTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0));
    
    const transactionCount = userTransactions.length;
    
    // Fish statistics
    const fishEntries = Object.entries(inventory);
    const totalFish = fishEntries.reduce((sum, [_, qty]) => sum + qty, 0);
    const uniqueFishTypes = fishEntries.length;
    
    // Calculate days since account creation
    const accountAge = user.created_at 
        ? Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
        : 0;
    
    // Count transactions by type
    const transactionsByType = {};
    userTransactions.forEach(t => {
        transactionsByType[t.type] = (transactionsByType[t.type] || 0) + 1;
    });
    
    return {
        user,
        balance: user.balance,
        totalEarned,
        totalSpent,
        transactionCount,
        totalFish,
        uniqueFishTypes,
        accountAge,
        transactionsByType,
        inventory
    };
}

/**
 * Migrate existing inventory to permanent collection (one-time migration)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 */
function migrateInventoryToCollection(userId, guildId) {
    const user = getUser(userId, guildId);
    
    // If collection doesn't exist or is empty, migrate from inventory
    if (!user.fish_collection || Object.keys(user.fish_collection).length === 0) {
        if (user.fish_inventory && Object.keys(user.fish_inventory).length > 0) {
            if (!user.fish_collection) {
                user.fish_collection = {};
            }
            
            // Add all fish from inventory to collection
            Object.keys(user.fish_inventory).forEach(fishName => {
                if (user.fish_inventory[fishName] > 0) {
                    user.fish_collection[fishName] = true;
                }
            });
            
            db.write();
        }
    }
}

/**
 * Check if user has collected all fish types
 * Uses permanent collection (fish_collection) instead of inventory
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {Object} allFishTypes - Object with all fish types (from FISH constant)
 * @returns {Object} { hasAll: boolean, collected: number, total: number, missing: string[] }
 */
export function checkCollectionComplete(userId, guildId, allFishTypes) {
    const user = getUser(userId, guildId);
    
    // Migrate existing inventory to collection if needed (one-time)
    migrateInventoryToCollection(userId, guildId);
    
    // Use permanent collection instead of inventory
    const collection = user.fish_collection || {};
    
    const allFishNames = Object.keys(allFishTypes);
    // Get all fish names that have been collected (marked as true in collection)
    const collectedFish = allFishNames.filter(fishName => collection[fishName] === true);
    
    const missing = allFishNames.filter(fishName => !collection[fishName]);
    const hasAll = missing.length === 0;
    
    return {
        hasAll,
        collected: collectedFish.length,
        total: allFishNames.length,
        missing: missing
    };
}

/**
 * Mark collection achievement as complete
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 */
export function markCollectionComplete(userId, guildId) {
    const user = getUser(userId, guildId);
    if (!user.achievements) {
        user.achievements = {};
    }
    user.achievements.collection_complete = true;
    user.achievements.collection_complete_date = new Date().toISOString();
    user.has_collection_complete = true;
    db.write();
}

/**
 * Get user achievements
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Object} User achievements
 */
export function getUserAchievements(userId, guildId) {
    const user = getUser(userId, guildId);
    return user.achievements || {};
}

/**
 * Check if user already has collection achievement
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {boolean} True if user already has the achievement
 */
export function hasCollectionAchievement(userId, guildId) {
    const user = getUser(userId, guildId);
    return user.has_collection_complete === true || (user.achievements && user.achievements.collection_complete === true);
}

/**
 * Reset fishing achievements for all users
 * Resets collection_complete achievement and optionally fish_collection
 * @param {boolean} resetCollection - If true, also resets fish_collection (default: false)
 * @returns {Object} { reset: number, usersAffected: number, totalUsers: number }
 */
export function resetFishingAchievements(resetCollection = false) {
    let usersAffected = 0;
    
    db.data.users.forEach(user => {
        let userModified = false;
        
        // Reset achievement flags
        if (user.has_collection_complete === true || (user.achievements && user.achievements.collection_complete === true)) {
            user.has_collection_complete = false;
            if (user.achievements) {
                delete user.achievements.collection_complete;
                delete user.achievements.collection_complete_date;
            } else {
                user.achievements = {};
            }
            userModified = true;
        }
        
        // Optionally reset fish collection
        if (resetCollection && user.fish_collection && Object.keys(user.fish_collection).length > 0) {
            user.fish_collection = {};
            userModified = true;
        }
        
        if (userModified) {
            usersAffected++;
        }
    });
    
    db.write();
    
    return {
        reset: usersAffected,
        usersAffected: usersAffected,
        totalUsers: db.data.users.length
    };
}

/**
 * Close database connection
 */
export function closeDatabase() {
    // Lowdb doesn't need explicit closing, but we can ensure data is written
    db.write();
}
