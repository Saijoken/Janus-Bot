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

-- Pokemon catches table
CREATE TABLE IF NOT EXISTS pokemon_catches (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    pokemon_id INTEGER NOT NULL,
    pokemon_name VARCHAR(100) NOT NULL,
    nickname VARCHAR(100),
    is_shiny BOOLEAN DEFAULT FALSE,
    caught_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level INTEGER DEFAULT 1,
    favorite BOOLEAN DEFAULT FALSE,
    evolution_stage INTEGER DEFAULT 1,
    is_mega BOOLEAN DEFAULT FALSE,
    mega_form VARCHAR(80)
);

-- Pokemon pokedex progress (tracks which species user has seen/caught)
CREATE TABLE IF NOT EXISTS pokemon_pokedex (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    pokemon_id INTEGER NOT NULL,
    pokemon_name VARCHAR(100) NOT NULL,
    caught_count INTEGER DEFAULT 1,
    first_caught_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shiny_caught BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, guild_id, pokemon_id)
);

-- Add last_catch column to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_catch TIMESTAMP;
-- Pokemon evolution: evolution_stage (1/2/3), is_mega, mega_form
ALTER TABLE pokemon_catches ADD COLUMN IF NOT EXISTS evolution_stage INTEGER DEFAULT 1;
ALTER TABLE pokemon_catches ADD COLUMN IF NOT EXISTS is_mega BOOLEAN DEFAULT FALSE;
ALTER TABLE pokemon_catches ADD COLUMN IF NOT EXISTS mega_form VARCHAR(80);
-- User mega stone inventory (stone_id -> quantity)
ALTER TABLE users ADD COLUMN IF NOT EXISTS mega_stones JSONB DEFAULT '{}'::jsonb;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_user_guild ON users(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_guild ON transactions(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_users_guild_balance ON users(guild_id, balance DESC);
CREATE INDEX IF NOT EXISTS idx_pokemon_catches_user_guild ON pokemon_catches(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_pokedex_user_guild ON pokemon_pokedex(user_id, guild_id);
