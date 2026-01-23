import dotenv from 'dotenv';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Client } = pg;

// Load existing JSON database
const adapter = new JSONFile(join(__dirname, 'economy.json'));
const db = new Low(adapter, { users: [], transactions: [] });
await db.read();

// PostgreSQL connection
const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'discordbot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function migrate() {
    try {
        console.log('🔄 Connexion à PostgreSQL...');
        await client.connect();
        console.log('✅ Connecté à PostgreSQL');

        // Create schema
        console.log('📋 Création du schéma...');
        const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
        await client.query(schema);
        console.log('✅ Schéma créé');

        // Reset fishing achievements before migration
        console.log('🔄 Réinitialisation des achievements de pêche...');
        let usersAffected = 0;
        db.data.users.forEach(user => {
            let userModified = false;
            
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
            
            if (userModified) {
                usersAffected++;
            }
        });
        console.log(`✅ ${usersAffected} utilisateurs réinitialisés`);

        // Migrate users
        console.log('📦 Migration des utilisateurs...');
        let usersMigrated = 0;
        
        for (const user of db.data.users) {
            const query = `
                INSERT INTO users (
                    user_id, guild_id, balance, last_daily, last_work,
                    voice_join_time, last_voice_reward, last_fish, created_at,
                    fish_inventory, fish_collection, achievements, has_collection_complete
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (user_id, guild_id) 
                DO UPDATE SET
                    balance = EXCLUDED.balance,
                    last_daily = EXCLUDED.last_daily,
                    last_work = EXCLUDED.last_work,
                    voice_join_time = EXCLUDED.voice_join_time,
                    last_voice_reward = EXCLUDED.last_voice_reward,
                    last_fish = EXCLUDED.last_fish,
                    fish_inventory = EXCLUDED.fish_inventory,
                    fish_collection = EXCLUDED.fish_collection,
                    achievements = EXCLUDED.achievements,
                    has_collection_complete = EXCLUDED.has_collection_complete
            `;
            
            await client.query(query, [
                user.user_id,
                user.guild_id,
                user.balance || 1000,
                user.last_daily || null,
                user.last_work || null,
                user.voice_join_time || null,
                user.last_voice_reward || null,
                user.last_fish || null,
                user.created_at || new Date().toISOString(),
                JSON.stringify(user.fish_inventory || {}),
                JSON.stringify(user.fish_collection || {}),
                JSON.stringify(user.achievements || {}),
                user.has_collection_complete || false
            ]);
            usersMigrated++;
        }
        console.log(`✅ ${usersMigrated} utilisateurs migrés`);

        // Migrate transactions
        console.log('📦 Migration des transactions...');
        let transactionsMigrated = 0;
        
        for (const transaction of db.data.transactions) {
            const query = `
                INSERT INTO transactions (user_id, guild_id, amount, type, description, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            `;
            
            await client.query(query, [
                transaction.user_id,
                transaction.guild_id,
                transaction.amount,
                transaction.type || 'other',
                transaction.description || null,
                transaction.created_at || new Date().toISOString()
            ]);
            transactionsMigrated++;
        }
        console.log(`✅ ${transactionsMigrated} transactions migrées`);

        console.log('\n✅ Migration terminée avec succès !');
        console.log(`📊 Résumé:`);
        console.log(`   - Utilisateurs: ${usersMigrated}`);
        console.log(`   - Transactions: ${transactionsMigrated}`);
        console.log(`   - Achievements réinitialisés: ${usersAffected}`);

    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    } finally {
        await client.end();
    }
}

migrate().catch(console.error);
