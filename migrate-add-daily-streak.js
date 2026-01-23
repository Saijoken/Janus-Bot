import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

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

async function migrate() {
    try {
        console.log('🔄 Ajout de la colonne daily_streak...');
        
        // Vérifier si la colonne existe déjà
        const checkResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='daily_streak'
        `);
        
        if (checkResult.rows.length > 0) {
            console.log('✅ La colonne daily_streak existe déjà.');
            return;
        }
        
        // Ajouter la colonne
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS daily_streak INTEGER DEFAULT 0
        `);
        
        console.log('✅ Colonne daily_streak ajoutée avec succès !');
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

migrate()
    .then(() => {
        console.log('✅ Migration terminée !');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Erreur:', error);
        process.exit(1);
    });
