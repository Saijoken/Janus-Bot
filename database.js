import pg from 'pg';

// Only load dotenv in development (Docker sets env vars directly)
if (process.env.NODE_ENV !== 'production') {
    const dotenv = await import('dotenv');
    dotenv.config();
}

const { Pool } = pg;

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'discordbot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * Get or create a user in the database
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} User object
 */
export async function getUser(userId, guildId) {
    const result = await pool.query(
        'SELECT * FROM users WHERE user_id = $1 AND guild_id = $2',
        [userId, guildId]
    );
    
    if (result.rows.length === 0) {
        // Create new user
        const insertResult = await pool.query(
            `INSERT INTO users (user_id, guild_id, balance, created_at)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, guildId, 1000, new Date().toISOString()]
        );
        return insertResult.rows[0];
    }
    
    const user = result.rows[0];
    
    // Ensure JSON fields are parsed
    if (typeof user.fish_inventory === 'string') {
        user.fish_inventory = JSON.parse(user.fish_inventory);
    }
    if (typeof user.fish_collection === 'string') {
        user.fish_collection = JSON.parse(user.fish_collection);
    }
    if (typeof user.achievements === 'string') {
        user.achievements = JSON.parse(user.achievements);
    }
    if (typeof user.mega_stones === 'string') {
        user.mega_stones = JSON.parse(user.mega_stones);
    }
    
    // Ensure defaults
    if (!user.fish_inventory) user.fish_inventory = {};
    if (!user.fish_collection) user.fish_collection = {};
    if (!user.achievements) user.achievements = {};
    if (!user.mega_stones) user.mega_stones = {};
    if (user.has_collection_complete === null) user.has_collection_complete = false;
    if (user.daily_streak === null || user.daily_streak === undefined) user.daily_streak = 0;
    
    return user;
}

/**
 * Get user balance
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<number>} User balance
 */
export async function getBalance(userId, guildId) {
    const user = await getUser(userId, guildId);
    return parseInt(user.balance) || 1000;
}

/**
 * Add money to user's balance
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - Amount to add
 * @param {string} type - Transaction type (e.g., 'daily', 'work', 'gift')
 * @param {string} description - Optional description
 * @returns {Promise<number>} New balance
 */
export async function addMoney(userId, guildId, amount, type = 'other', description = null) {
    const user = await getUser(userId, guildId);
    const newBalance = parseInt(user.balance) + amount;
    
    await pool.query(
        'UPDATE users SET balance = $1 WHERE user_id = $2 AND guild_id = $3',
        [newBalance, userId, guildId]
    );
    
    // Add transaction
    await pool.query(
        `INSERT INTO transactions (user_id, guild_id, amount, type, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, guildId, amount, type, description || `${type}: +${amount}`, new Date().toISOString()]
    );
    
    return newBalance;
}

/**
 * Remove money from user's balance
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - Amount to remove
 * @param {string} type - Transaction type
 * @param {string} description - Optional description
 * @returns {Promise<number|null>} New balance, or null if insufficient funds
 */
export async function removeMoney(userId, guildId, amount, type = 'other', description = null) {
    const user = await getUser(userId, guildId);
    
    if (parseInt(user.balance) < amount) {
        return null; // Insufficient funds
    }
    
    const newBalance = parseInt(user.balance) - amount;
    
    await pool.query(
        'UPDATE users SET balance = $1 WHERE user_id = $2 AND guild_id = $3',
        [newBalance, userId, guildId]
    );
    
    // Add transaction
    await pool.query(
        `INSERT INTO transactions (user_id, guild_id, amount, type, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, guildId, -amount, type, description || `${type}: -${amount}`, new Date().toISOString()]
    );
    
    return newBalance;
}

/**
 * Transfer money between users
 * @param {string} fromUserId - Sender user ID
 * @param {string} toUserId - Receiver user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - Amount to transfer
 * @returns {Promise<boolean>} True if successful, false if insufficient funds
 */
export async function transferMoney(fromUserId, toUserId, guildId, amount) {
    if (amount <= 0) {
        return false;
    }
    
    const fromUser = await getUser(fromUserId, guildId);
    if (parseInt(fromUser.balance) < amount) {
        return false; // Insufficient funds
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Update sender balance
        await client.query(
            'UPDATE users SET balance = balance - $1 WHERE user_id = $2 AND guild_id = $3',
            [amount, fromUserId, guildId]
        );
        
        // Update receiver balance
        await client.query(
            'UPDATE users SET balance = balance + $1 WHERE user_id = $2 AND guild_id = $3',
            [amount, toUserId, guildId]
        );
        
        // Add transactions
        const now = new Date().toISOString();
        await client.query(
            `INSERT INTO transactions (user_id, guild_id, amount, type, description, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fromUserId, guildId, -amount, 'transfer', `Transfer to ${toUserId}`, now]
        );
        await client.query(
            `INSERT INTO transactions (user_id, guild_id, amount, type, description, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [toUserId, guildId, amount, 'transfer', `Transfer from ${fromUserId}`, now]
        );
        
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Set user's balance to a specific amount
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - New balance amount
 */
export async function setBalance(userId, guildId, amount) {
    await pool.query(
        'UPDATE users SET balance = $1 WHERE user_id = $2 AND guild_id = $3',
        [amount, userId, guildId]
    );
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
    
    // Get current date in Paris timezone as string parts
    const parisDateParts = now.toLocaleDateString('en-CA', { 
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split('-');
    
    const parisTimeParts = now.toLocaleTimeString('en-GB', { 
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).split(':');
    
    // Calculate seconds until midnight Paris time
    const currentHour = parseInt(parisTimeParts[0]);
    const currentMinute = parseInt(parisTimeParts[1]);
    const currentSecond = parseInt(parisTimeParts[2]);
    
    const secondsUntilMidnight = ((23 - currentHour) * 3600) + ((59 - currentMinute) * 60) + (60 - currentSecond);
    
    // Return a Date object representing next midnight
    return new Date(now.getTime() + (secondsUntilMidnight * 1000));
}

/**
 * Check if user can claim daily reward (resets at midnight Paris time)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<boolean>} True if can claim, false otherwise
 */
export async function canClaimDaily(userId, guildId) {
    const user = await getUser(userId, guildId);
    
    if (!user.last_daily) {
        return true;
    }
    
    const lastDailyDate = new Date(user.last_daily).toLocaleDateString('en-CA', { 
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const currentDate = getParisDate();
    
    return lastDailyDate !== currentDate;
}

/**
 * Calculate streak bonus based on current streak
 * @param {number} streak - Current streak count
 * @returns {number} Bonus amount
 */
function calculateStreakBonus(streak) {
    if (streak >= 5) return 500;
    if (streak >= 4) return 300;
    if (streak >= 3) return 100;
    if (streak >= 2) return 50;
    return 0;
}

/**
 * Check if last daily was yesterday (to continue streak)
 * @param {Date} lastDaily - Last daily date
 * @returns {boolean} True if last daily was yesterday
 */
function wasYesterday(lastDaily) {
    if (!lastDaily) return false;
    
    const lastDailyDate = new Date(lastDaily).toLocaleDateString('en-CA', { 
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toLocaleDateString('en-CA', { 
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    return lastDailyDate === yesterdayDate;
}

/**
 * Claim daily reward (resets at midnight Paris time)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} amount - Daily reward amount (default: 500)
 * @returns {Promise<Object>} { success: boolean, balance: number, message: string, streak: number, bonus: number }
 */
export async function claimDaily(userId, guildId, amount = 500) {
    if (!(await canClaimDaily(userId, guildId))) {
        const user = await getUser(userId, guildId);
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
            balance: parseInt(user.balance),
            message: `Vous avez déjà réclamé votre récompense quotidienne aujourd'hui ! Revenez dans ${timeLeft}.`,
            streak: user.daily_streak || 0
        };
    }
    
    const user = await getUser(userId, guildId);
    let currentStreak = user.daily_streak || 0;
    let newStreak = currentStreak;
    let streakCompleted = false;
    
    // Check if streak should continue or reset
    if (wasYesterday(user.last_daily)) {
        // Continue streak
        newStreak = currentStreak + 1;
    } else {
        // Reset streak (first daily or missed a day)
        newStreak = 1;
    }
    
    // Calculate bonus based on new streak (after increment)
    const streakBonus = calculateStreakBonus(newStreak);
    const totalAmount = amount + streakBonus;
    
    // Add money
    const newBalance = await addMoney(userId, guildId, totalAmount, 'daily', `Daily reward${streakBonus > 0 ? ` + streak bonus (${newStreak} days)` : ''}`);
    
    // Reset streak after 5 days
    if (newStreak >= 5) {
        streakCompleted = true;
        newStreak = 0;
    }
    
    // Update last_daily and daily_streak
    await pool.query(
        'UPDATE users SET last_daily = $1, daily_streak = $2 WHERE user_id = $3 AND guild_id = $4',
        [new Date().toISOString(), newStreak, userId, guildId]
    );
    
    // Build message
    let message = `Vous avez réclamé votre récompense quotidienne de **${amount.toLocaleString()}** coins !`;
    
    if (streakBonus > 0) {
        const streakDays = streakCompleted ? 5 : newStreak;
        message += `\n🔥 **Bonus de streak (${streakDays} jour${streakDays > 1 ? 's' : ''} consécutif${streakDays > 1 ? 's' : ''}) : +${streakBonus.toLocaleString()} coins**`;
    }
    
    if (streakCompleted) {
        message += `\n🎉 **Streak de 5 jours complété ! Le streak a été réinitialisé.**`;
    } else if (newStreak > 1) {
        message += `\n📊 **Streak actuel : ${newStreak} jour${newStreak > 1 ? 's' : ''} consécutif${newStreak > 1 ? 's' : ''}**`;
    } else if (newStreak === 1) {
        message += `\n📊 **Streak actuel : 1 jour**`;
    }
    
    message += `\n💰 Votre nouveau solde est de **${newBalance.toLocaleString()}** coins.`;
    
    return {
        success: true,
        balance: newBalance,
        message: message,
        streak: streakCompleted ? 5 : newStreak, // Show 5 if just completed
        bonus: streakBonus
    };
}

/**
 * Get top users by balance
 * @param {string} guildId - Discord guild ID
 * @param {number} limit - Number of users to return (default: 10)
 * @returns {Promise<Array>} Array of user objects
 */
export async function getTopUsers(guildId, limit = 10) {
    const result = await pool.query(
        'SELECT user_id, balance FROM users WHERE guild_id = $1 ORDER BY balance DESC LIMIT $2',
        [guildId, limit]
    );
    return result.rows;
}

/**
 * Check if user can work (5 hour cooldown)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<boolean>} True if can work, false otherwise
 */
export async function canWork(userId, guildId) {
    const user = await getUser(userId, guildId);
    
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
export async function updateLastWork(userId, guildId) {
    await pool.query(
        'UPDATE users SET last_work = $1 WHERE user_id = $2 AND guild_id = $3',
        [new Date().toISOString(), userId, guildId]
    );
}

/**
 * Set voice join time
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 */
export async function setVoiceJoinTime(userId, guildId) {
    const user = await getUser(userId, guildId);
    if (!user.voice_join_time) {
        await pool.query(
            'UPDATE users SET voice_join_time = $1 WHERE user_id = $2 AND guild_id = $3',
            [new Date().toISOString(), userId, guildId]
        );
    }
}

/**
 * Clear voice join time
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 */
export async function clearVoiceJoinTime(userId, guildId) {
    await pool.query(
        'UPDATE users SET voice_join_time = NULL, last_voice_reward = NULL WHERE user_id = $1 AND guild_id = $2',
        [userId, guildId]
    );
}

/**
 * Check and reward voice channel time (50 coins every 30 minutes after first 30 minutes)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object|null>} { rewarded: boolean, amount: number, balance: number } or null if not eligible
 */
export async function checkVoiceReward(userId, guildId) {
    const user = await getUser(userId, guildId);
    
    if (!user.voice_join_time) {
        return null;
    }
    
    const joinTime = new Date(user.voice_join_time);
    const now = new Date();
    const minutesInVoice = (now - joinTime) / (1000 * 60);
    
    if (minutesInVoice >= 240) {
        return null; // Reached 4-hour cap
    }
    
    if (minutesInVoice < 30) {
        return null;
    }
    
    const lastReward = user.last_voice_reward ? new Date(user.last_voice_reward) : null;
    const minutesSinceLastReward = lastReward ? (now - lastReward) / (1000 * 60) : Infinity;
    
    if (minutesSinceLastReward >= 30) {
        if (minutesInVoice >= 240) {
            return null;
        }
        
        const reward = 50;
        const newBalance = await addMoney(userId, guildId, reward, 'voice', 'Voice channel reward (30 minutes)');
        
        await pool.query(
            'UPDATE users SET last_voice_reward = $1 WHERE user_id = $2 AND guild_id = $3',
            [now.toISOString(), userId, guildId]
        );
        
        return {
            rewarded: true,
            amount: reward,
            balance: newBalance
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
 * @returns {Date} Next hour
 */
function getNextHourParis() {
    const now = new Date();
    const parisMinute = parseInt(now.toLocaleString('en-US', { 
        timeZone: 'Europe/Paris',
        minute: '2-digit'
    }));
    const parisSecond = parseInt(now.toLocaleString('en-US', { 
        timeZone: 'Europe/Paris',
        second: '2-digit'
    }));
    const parisMs = now.getMilliseconds();
    
    const minutesRemaining = 60 - parisMinute - 1;
    const secondsInCurrentMinute = 60 - parisSecond - 1;
    const msInCurrentSecond = 1000 - parisMs;
    
    const totalMsUntilNextHour = (minutesRemaining * 60 * 1000) + (secondsInCurrentMinute * 1000) + msInCurrentSecond;
    
    return new Date(now.getTime() + totalMsUntilNextHour);
}

/**
 * Check if user can fish (resets at each hour in Paris time)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} { canFish: boolean, timeRemaining: number (seconds) }
 */
export async function canFish(userId, guildId) {
    const user = await getUser(userId, guildId);
    
    if (!user.last_fish) {
        return { canFish: true, timeRemaining: 0 };
    }
    
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
    
    if (lastFishDateStr !== currentDate || lastFishHour !== currentHour) {
        return { canFish: true, timeRemaining: 0 };
    }
    
    const nextHour = getNextHourParis();
    const now = new Date();
    const msUntilNextHour = nextHour - now;
    let timeRemaining = Math.ceil(msUntilNextHour / 1000);
    
    const MAX_COOLDOWN_SECONDS = 3600;
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
export async function updateLastFish(userId, guildId) {
    await pool.query(
        'UPDATE users SET last_fish = $1 WHERE user_id = $2 AND guild_id = $3',
        [new Date().toISOString(), userId, guildId]
    );
}

/**
 * Add fish to user inventory and collection
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} fishName - Name of the fish
 * @param {number} quantity - Quantity to add (default 1)
 */
export async function addFish(userId, guildId, fishName, quantity = 1) {
    const user = await getUser(userId, guildId);
    
    const inventory = user.fish_inventory || {};
    if (!inventory[fishName]) {
        inventory[fishName] = 0;
    }
    inventory[fishName] += quantity;
    
    const collection = user.fish_collection || {};
    if (!collection[fishName]) {
        collection[fishName] = true;
    }
    
    await pool.query(
        'UPDATE users SET fish_inventory = $1, fish_collection = $2 WHERE user_id = $3 AND guild_id = $4',
        [JSON.stringify(inventory), JSON.stringify(collection), userId, guildId]
    );
}

/**
 * Get user fish inventory
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} Fish inventory object
 */
export async function getFishInventory(userId, guildId) {
    const user = await getUser(userId, guildId);
    return user.fish_inventory || {};
}

/**
 * Get user fish collection (permanent - for achievements)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} Fish collection object
 */
export async function getFishCollection(userId, guildId) {
    const user = await getUser(userId, guildId);
    return user.fish_collection || {};
}

/**
 * Remove fish from user inventory
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} fishName - Name of the fish
 * @param {number} quantity - Quantity to remove
 * @returns {Promise<boolean>} True if successful, false if insufficient quantity
 */
export async function removeFish(userId, guildId, fishName, quantity = 1) {
    const user = await getUser(userId, guildId);
    const inventory = user.fish_inventory || {};
    
    if (!inventory[fishName] || inventory[fishName] < quantity) {
        return false;
    }
    
    inventory[fishName] -= quantity;
    if (inventory[fishName] === 0) {
        delete inventory[fishName];
    }
    
    await pool.query(
        'UPDATE users SET fish_inventory = $1 WHERE user_id = $2 AND guild_id = $3',
        [JSON.stringify(inventory), userId, guildId]
    );
    
    return true;
}

/**
 * Get user statistics
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} User statistics object
 */
export async function getUserStats(userId, guildId) {
    const user = await getUser(userId, guildId);
    const inventory = user.fish_inventory || {};
    
    const result = await pool.query(
        'SELECT * FROM transactions WHERE user_id = $1 AND guild_id = $2',
        [userId, guildId]
    );
    
    const userTransactions = result.rows;
    
    const totalEarned = userTransactions
        .filter(t => parseInt(t.amount) > 0)
        .reduce((sum, t) => sum + parseInt(t.amount), 0);
    
    const totalSpent = Math.abs(userTransactions
        .filter(t => parseInt(t.amount) < 0)
        .reduce((sum, t) => sum + parseInt(t.amount), 0));
    
    const transactionCount = userTransactions.length;
    
    const fishEntries = Object.entries(inventory);
    const totalFish = fishEntries.reduce((sum, [_, qty]) => sum + qty, 0);
    const uniqueFishTypes = fishEntries.length;
    
    const accountAge = user.created_at 
        ? Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
        : 0;
    
    const transactionsByType = {};
    userTransactions.forEach(t => {
        transactionsByType[t.type] = (transactionsByType[t.type] || 0) + 1;
    });
    
    return {
        user,
        balance: parseInt(user.balance),
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
 * Check if user has collected all fish types
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {Object} allFishTypes - Object with all fish types
 * @returns {Promise<Object>} { hasAll: boolean, collected: number, total: number, missing: string[] }
 */
export async function checkCollectionComplete(userId, guildId, allFishTypes) {
    const user = await getUser(userId, guildId);
    const collection = user.fish_collection || {};
    
    const allFishNames = Object.keys(allFishTypes);
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
export async function markCollectionComplete(userId, guildId) {
    const user = await getUser(userId, guildId);
    const achievements = user.achievements || {};
    achievements.collection_complete = true;
    achievements.collection_complete_date = new Date().toISOString();
    
    await pool.query(
        'UPDATE users SET achievements = $1, has_collection_complete = $2 WHERE user_id = $3 AND guild_id = $4',
        [JSON.stringify(achievements), true, userId, guildId]
    );
}

/**
 * Get user achievements
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} User achievements
 */
export async function getUserAchievements(userId, guildId) {
    const user = await getUser(userId, guildId);
    return user.achievements || {};
}

/**
 * Check if user already has collection achievement
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<boolean>} True if user already has the achievement
 */
export async function hasCollectionAchievement(userId, guildId) {
    const user = await getUser(userId, guildId);
    return user.has_collection_complete === true || (user.achievements && user.achievements.collection_complete === true);
}

/**
 * Migrate fish from inventory to collection for all users
 * This ensures that any fish in a user's inventory is also marked as collected
 * @returns {Promise<Object>} { migrated: number, usersAffected: number, totalUsers: number }
 */
export async function migrateInventoryToCollection() {
    try {
        // Get all users
        const result = await pool.query('SELECT user_id, guild_id, fish_inventory, fish_collection FROM users');
        const users = result.rows;
        
        let usersAffected = 0;
        let totalFishMigrated = 0;
        
        for (const user of users) {
            let inventory = {};
            let collection = {};
            
            // Parse JSON fields
            if (typeof user.fish_inventory === 'string') {
                try {
                    inventory = JSON.parse(user.fish_inventory);
                } catch (e) {
                    inventory = {};
                }
            } else if (user.fish_inventory) {
                inventory = user.fish_inventory;
            }
            
            if (typeof user.fish_collection === 'string') {
                try {
                    collection = JSON.parse(user.fish_collection);
                } catch (e) {
                    collection = {};
                }
            } else if (user.fish_collection) {
                collection = user.fish_collection;
            }
            
            // Check if there are fish in inventory that are not in collection
            let hasChanges = false;
            const fishNames = Object.keys(inventory);
            
            for (const fishName of fishNames) {
                // If fish exists in inventory (quantity > 0) and not in collection, add it
                if (inventory[fishName] > 0 && !collection[fishName]) {
                    collection[fishName] = true;
                    hasChanges = true;
                    totalFishMigrated++;
                }
            }
            
            // Update user if there were changes
            if (hasChanges) {
                await pool.query(
                    'UPDATE users SET fish_collection = $1 WHERE user_id = $2 AND guild_id = $3',
                    [JSON.stringify(collection), user.user_id, user.guild_id]
                );
                usersAffected++;
            }
        }
        
        return {
            migrated: totalFishMigrated,
            usersAffected: usersAffected,
            totalUsers: users.length
        };
    } catch (error) {
        console.error('Error migrating inventory to collection:', error);
        throw error;
    }
}

/**
 * Reset fishing achievements for all users
 * @param {boolean} resetCollection - If true, also resets fish_collection (default: false)
 * @returns {Promise<Object>} { reset: number, usersAffected: number, totalUsers: number }
 */
export async function resetFishingAchievements(resetCollection = false) {
    let query;
    if (resetCollection) {
        query = `UPDATE users 
                 SET has_collection_complete = FALSE, 
                     achievements = achievements - 'collection_complete' - 'collection_complete_date',
                     fish_collection = '{}'::jsonb
                 WHERE has_collection_complete = TRUE 
                    OR achievements ? 'collection_complete'`;
    } else {
        query = `UPDATE users 
                 SET has_collection_complete = FALSE, 
                     achievements = achievements - 'collection_complete' - 'collection_complete_date'
                 WHERE has_collection_complete = TRUE 
                    OR achievements ? 'collection_complete'`;
    }
    
    const result = await pool.query(query);
    const totalResult = await pool.query('SELECT COUNT(*) FROM users');
    
    return {
        reset: result.rowCount,
        usersAffected: result.rowCount,
        totalUsers: parseInt(totalResult.rows[0].count)
    };
}

/**
 * Hard reset all user data to default values
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
export async function hardResetUser(userId, guildId) {
    try {
        // Start transaction
        await pool.query('BEGIN');
        
        // Delete all transactions for this user
        await pool.query(
            'DELETE FROM transactions WHERE user_id = $1 AND guild_id = $2',
            [userId, guildId]
        );
        
        // Reset all user data to defaults
        await pool.query(
            `UPDATE users 
             SET balance = 1000,
                 last_daily = NULL,
                 last_work = NULL,
                 voice_join_time = NULL,
                 last_voice_reward = NULL,
                 last_fish = NULL,
                 fish_inventory = '{}'::jsonb,
                 fish_collection = '{}'::jsonb,
                 achievements = '{}'::jsonb,
                 has_collection_complete = FALSE,
                 daily_streak = 0
             WHERE user_id = $1 AND guild_id = $2`,
            [userId, guildId]
        );
        
        // Commit transaction
        await pool.query('COMMIT');
        
        return {
            success: true,
            message: 'Toutes les données de l\'utilisateur ont été réinitialisées aux valeurs par défaut.'
        };
    } catch (error) {
        // Rollback on error
        await pool.query('ROLLBACK').catch(() => {});
        console.error('Error in hardResetUser:', error);
        return {
            success: false,
            message: `Erreur lors de la réinitialisation: ${error.message}`
        };
    }
}

// ==================== POKEMON FUNCTIONS ====================

/**
 * Check if user can catch a Pokemon (cooldown check)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} cooldownMinutes - Cooldown in minutes (default 5)
 * @returns {Promise<{canCatch: boolean, remainingTime: number}>}
 */
export async function canCatchPokemon(userId, guildId, cooldownMinutes = 5) {
    const user = await getUser(userId, guildId);
    
    if (!user.last_catch) {
        return { canCatch: true, remainingTime: 0 };
    }
    
    const lastCatch = new Date(user.last_catch);
    const now = new Date();
    const diffMs = now - lastCatch;
    const diffMinutes = diffMs / (1000 * 60);
    
    if (diffMinutes >= cooldownMinutes) {
        return { canCatch: true, remainingTime: 0 };
    }
    
    const remainingMs = (cooldownMinutes * 60 * 1000) - diffMs;
    return { canCatch: false, remainingTime: remainingMs };
}

/**
 * Update last catch time
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 */
export async function updateLastCatch(userId, guildId) {
    await pool.query(
        'UPDATE users SET last_catch = $1 WHERE user_id = $2 AND guild_id = $3',
        [new Date().toISOString(), userId, guildId]
    );
}

/**
 * Add a caught Pokemon to user's collection
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {Object} pokemon - Pokemon data {id, name, isShiny}
 * @returns {Promise<Object>} Catch result
 */
export async function addPokemonCatch(userId, guildId, pokemon) {
    const { id, name, isShiny } = pokemon;
    
    // Add to catches table (evolution_stage=1, is_mega=false by default)
    await pool.query(
        `INSERT INTO pokemon_catches (user_id, guild_id, pokemon_id, pokemon_name, is_shiny, caught_at, evolution_stage, is_mega)
         VALUES ($1, $2, $3, $4, $5, $6, 1, FALSE)`,
        [userId, guildId, id, name, isShiny, new Date().toISOString()]
    );
    
    // Update or insert into pokedex
    const existing = await pool.query(
        'SELECT * FROM pokemon_pokedex WHERE user_id = $1 AND guild_id = $2 AND pokemon_id = $3',
        [userId, guildId, id]
    );
    
    let isNewEntry = false;
    let isFirstShiny = false;
    
    if (existing.rows.length === 0) {
        // New Pokedex entry
        await pool.query(
            `INSERT INTO pokemon_pokedex (user_id, guild_id, pokemon_id, pokemon_name, caught_count, first_caught_at, shiny_caught)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, guildId, id, name, 1, new Date().toISOString(), isShiny]
        );
        isNewEntry = true;
        isFirstShiny = isShiny;
    } else {
        // Update existing entry
        const updateShiny = isShiny && !existing.rows[0].shiny_caught;
        isFirstShiny = updateShiny;
        
        await pool.query(
            `UPDATE pokemon_pokedex 
             SET caught_count = caught_count + 1, shiny_caught = shiny_caught OR $4
             WHERE user_id = $1 AND guild_id = $2 AND pokemon_id = $3`,
            [userId, guildId, id, isShiny]
        );
    }
    
    // Update last catch time
    await updateLastCatch(userId, guildId);
    
    return { isNewEntry, isFirstShiny };
}

/**
 * Get user's Pokedex progress
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object[]>} Pokedex entries
 */
export async function getPokedex(userId, guildId) {
    const result = await pool.query(
        `SELECT * FROM pokemon_pokedex 
         WHERE user_id = $1 AND guild_id = $2 
         ORDER BY pokemon_id ASC`,
        [userId, guildId]
    );
    return result.rows;
}

/**
 * Get user's Pokemon collection (all catches)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} limit - Max results
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object[]>} Pokemon catches
 */
export async function getPokemonCollection(userId, guildId, limit = 20, offset = 0) {
    const result = await pool.query(
        `SELECT * FROM pokemon_catches 
         WHERE user_id = $1 AND guild_id = $2 
         ORDER BY caught_at DESC
         LIMIT $3 OFFSET $4`,
        [userId, guildId, limit, offset]
    );
    return result.rows;
}

/**
 * Get total Pokemon count for user
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} Counts {total, unique, shiny}
 */
export async function getPokemonCounts(userId, guildId) {
    const totalResult = await pool.query(
        'SELECT COUNT(*) as total FROM pokemon_catches WHERE user_id = $1 AND guild_id = $2',
        [userId, guildId]
    );
    
    const uniqueResult = await pool.query(
        'SELECT COUNT(*) as unique FROM pokemon_pokedex WHERE user_id = $1 AND guild_id = $2',
        [userId, guildId]
    );
    
    const shinyResult = await pool.query(
        'SELECT COUNT(*) as shiny FROM pokemon_catches WHERE user_id = $1 AND guild_id = $2 AND is_shiny = true',
        [userId, guildId]
    );
    
    return {
        total: parseInt(totalResult.rows[0].total) || 0,
        unique: parseInt(uniqueResult.rows[0].unique) || 0,
        shiny: parseInt(shinyResult.rows[0].shiny) || 0
    };
}

/**
 * Get user's catch(es) for a given Pokedex Pokemon ID (e.g. 1 = Bulbasaur)
 * Returns the most recent catch of that species.
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} pokemonId - Pokedex species ID
 * @param {number} limit - Max results (default 1)
 * @returns {Promise<Object[]>} Catch rows
 */
export async function getPokemonCatchesByPokemonId(userId, guildId, pokemonId, limit = 1) {
    const result = await pool.query(
        `SELECT * FROM pokemon_catches 
         WHERE user_id = $1 AND guild_id = $2 AND pokemon_id = $3 
         ORDER BY caught_at DESC
         LIMIT $4`,
        [userId, guildId, pokemonId, limit]
    );
    return result.rows;
}

/**
 * Get a single Pokemon catch by id (must belong to user/guild)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} catchId - Catch row id
 * @returns {Promise<Object|null>} Catch row or null
 */
export async function getPokemonCatchById(userId, guildId, catchId) {
    const result = await pool.query(
        'SELECT * FROM pokemon_catches WHERE id = $1 AND user_id = $2 AND guild_id = $3',
        [catchId, userId, guildId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return row;
}

/**
 * Update a Pokemon's evolution (normal evolve or mega)
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} catchId - Catch row id
 * @param {Object} data - { pokemonId, pokemonName, evolutionStage, isMega?, megaForm? }
 * @returns {Promise<boolean>} Success
 */
export async function updatePokemonEvolution(userId, guildId, catchId, data) {
    const { pokemonId, pokemonName, evolutionStage, isMega = false, megaForm = null } = data;
    const result = await pool.query(
        `UPDATE pokemon_catches
         SET pokemon_id = $1, pokemon_name = $2, evolution_stage = $3, is_mega = $4, mega_form = $5
         WHERE id = $6 AND user_id = $7 AND guild_id = $8`,
        [pokemonId, pokemonName, evolutionStage, isMega, megaForm, catchId, userId, guildId]
    );
    return result.rowCount > 0;
}

/**
 * Get user's mega stone inventory { stoneId: quantity }
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>}
 */
export async function getMegaStones(userId, guildId) {
    const user = await getUser(userId, guildId);
    const stones = user.mega_stones && typeof user.mega_stones === 'object' ? user.mega_stones : {};
    return stones;
}

/**
 * Add mega stone(s) to user inventory
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} stoneId - e.g. 'charizardite-x'
 * @param {number} quantity - Number to add
 * @returns {Promise<number>} New quantity for that stone
 */
export async function addMegaStone(userId, guildId, stoneId, quantity = 1) {
    const user = await getUser(userId, guildId);
    const stones = { ...(user.mega_stones || {}) };
    stones[stoneId] = (stones[stoneId] || 0) + quantity;
    await pool.query(
        'UPDATE users SET mega_stones = $1 WHERE user_id = $2 AND guild_id = $3',
        [JSON.stringify(stones), userId, guildId]
    );
    return stones[stoneId];
}

/**
 * Use (consume) one mega stone from user inventory
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} stoneId - e.g. 'charizardite-x'
 * @returns {Promise<boolean>} True if had stone and consumed it
 */
export async function useMegaStone(userId, guildId, stoneId) {
    const user = await getUser(userId, guildId);
    const stones = { ...(user.mega_stones || {}) };
    const current = stones[stoneId] || 0;
    if (current < 1) return false;
    stones[stoneId] = current - 1;
    if (stones[stoneId] === 0) delete stones[stoneId];
    await pool.query(
        'UPDATE users SET mega_stones = $1 WHERE user_id = $2 AND guild_id = $3',
        [JSON.stringify(stones), userId, guildId]
    );
    return true;
}

/**
 * Release a Pokemon
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {number} catchId - ID of the catch to release
 * @returns {Promise<boolean>} Success
 */
export async function releasePokemon(userId, guildId, catchId) {
    const result = await pool.query(
        'DELETE FROM pokemon_catches WHERE id = $1 AND user_id = $2 AND guild_id = $3 RETURNING *',
        [catchId, userId, guildId]
    );
    return result.rowCount > 0;
}

/**
 * Close database connection
 */
export async function closeDatabase() {
    await pool.end();
}
