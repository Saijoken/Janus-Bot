-- PostgreSQL Schema for Discord Bot Economy System

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    balance BIGINT DEFAULT 1000,
    last_daily TIMESTAMP,
    last_work TIMESTAMP,
    voice_join_time TIMESTAMP,
    last_voice_reward TIMESTAMP,
    last_fish TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fish_inventory JSONB DEFAULT '{}'::jsonb,
    fish_collection JSONB DEFAULT '{}'::jsonb,
    achievements JSONB DEFAULT '{}'::jsonb,
    has_collection_complete BOOLEAN DEFAULT FALSE,
    daily_streak INTEGER DEFAULT 0,
    UNIQUE(user_id, guild_id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_user_guild ON users(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_guild ON transactions(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_users_guild_balance ON users(guild_id, balance DESC);
