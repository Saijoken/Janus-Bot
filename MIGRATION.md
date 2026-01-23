# Guide de Migration vers PostgreSQL

Ce guide explique comment migrer les données du bot Discord de JSON (lowdb) vers PostgreSQL.

## Prérequis

- PostgreSQL installé sur le serveur
- Accès root/sudo pour installer PostgreSQL si nécessaire

## Étapes de Migration

### 1. Installer PostgreSQL (si nécessaire)

```bash
./setup-postgresql.sh
```

Ou manuellement :
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Créer la base de données

Le script `setup-postgresql.sh` crée automatiquement :
- Base de données : `discordbot`
- Utilisateur : `discordbot_user`
- Mot de passe : `discordbot_password`

### 3. Configurer les variables d'environnement

Ajoutez ces variables dans votre fichier `.env` :

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=discordbot
DB_USER=discordbot_user
DB_PASSWORD=discordbot_password
```

### 4. Exécuter la migration

```bash
node migrate-to-postgresql.js
```

Ce script va :
- ✅ Réinitialiser les achievements de pêche pour tous les utilisateurs
- ✅ Créer le schéma de base de données
- ✅ Migrer tous les utilisateurs
- ✅ Migrer toutes les transactions

### 5. Modifier le code pour utiliser PostgreSQL

**Option A : Remplacer database.js (recommandé)**

```bash
# Sauvegarder l'ancien fichier
mv database.js database-json.js

# Utiliser la nouvelle version PostgreSQL
mv database-pg.js database.js
```

**Option B : Modifier index.js pour utiliser database-pg.js**

Modifiez les imports dans `index.js` :
```javascript
import { ... } from './database-pg.js';
```

### 6. Redémarrer le bot

```bash
# Si vous utilisez Docker
docker compose restart

# Ou directement
npm start
```

## Vérification

Vérifiez que tout fonctionne :
```bash
# Se connecter à PostgreSQL
sudo -u postgres psql -d discordbot

# Vérifier les tables
\dt

# Vérifier les utilisateurs
SELECT COUNT(*) FROM users;

# Vérifier les transactions
SELECT COUNT(*) FROM transactions;

# Vérifier que les achievements sont réinitialisés
SELECT COUNT(*) FROM users WHERE has_collection_complete = TRUE;
```

## Rollback (retour en arrière)

Si vous devez revenir à JSON :

```bash
# Restaurer l'ancien fichier
mv database.js database-pg.js
mv database-json.js database.js

# Redémarrer le bot
docker compose restart
```

## Notes importantes

- ⚠️ **Sauvegardez** votre fichier `economy.json` avant la migration
- ⚠️ Les achievements de pêche sont **réinitialisés** pour tous les utilisateurs
- ⚠️ La collection de poissons (`fish_collection`) est **conservée** (seulement les achievements sont réinitialisés)
- ✅ Toutes les autres données (balance, transactions, inventaire) sont **migrées intactes**

## Support

En cas de problème, vérifiez :
1. Que PostgreSQL est démarré : `sudo systemctl status postgresql`
2. Que les variables d'environnement sont correctes
3. Les logs du bot pour les erreurs de connexion
