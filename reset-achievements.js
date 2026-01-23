import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load existing JSON database
const adapter = new JSONFile(join(__dirname, 'economy.json'));
const db = new Low(adapter, { users: [], transactions: [] });
await db.read();

console.log('🔄 Réinitialisation des achievements de pêche...');

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
    
    if (userModified) {
        usersAffected++;
    }
});

await db.write();

console.log(`✅ ${usersAffected} utilisateurs réinitialisés sur ${db.data.users.length} total`);
console.log('✅ Achievements de pêche réinitialisés avec succès !');
