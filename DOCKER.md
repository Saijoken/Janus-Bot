# Guide Docker pour le Bot Discord

Ce guide explique comment déployer le bot Discord en utilisant Docker pour qu'il fonctionne 24/7.

## Prérequis

- Docker installé sur votre serveur
- Docker Compose installé (généralement inclus avec Docker)
- Un fichier `.env` avec vos variables d'environnement

## Configuration

### 1. Créer le fichier .env

Créez un fichier `.env` à la racine du projet avec vos variables d'environnement :

```env
DISCORD_TOKEN=votre_token_discord_ici
COUNTER_CHANNEL_ID=votre_channel_id_ici
```

**Important :** Ne commitez jamais le fichier `.env` dans Git !

### 2. Construire l'image Docker

```bash
docker-compose build
```

Ou avec Docker directement :

```bash
docker build -t discordbot .
```

## Utilisation

### Démarrer le bot avec Docker Compose (recommandé)

```bash
# Démarrer le bot
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter le bot
docker-compose down

# Redémarrer le bot
docker-compose restart
```

### Démarrer le bot avec Docker directement

```bash
# Construire l'image
docker build -t discordbot .

# Lancer le conteneur
docker run -d \
  --name discordbot \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/economy.json:/app/economy.json \
  discordbot

# Voir les logs
docker logs -f discordbot

# Arrêter le bot
docker stop discordbot

# Redémarrer le bot
docker start discordbot
```

## Commandes utiles

### Voir les logs en temps réel

**Option 1 : Utiliser le script pratique (recommandé)**
```bash
# Voir les dernières 50 lignes
./view-logs.sh

# Suivre les logs en temps réel (comme tail -f)
./view-logs.sh -f

# Voir les dernières 100 lignes
./view-logs.sh -n 100

# Voir tous les logs depuis le début
./view-logs.sh --all
```

**Option 2 : Utiliser directement Docker Compose**
```bash
# Voir les dernières lignes
docker compose logs --tail=50 discordbot

# Suivre les logs en temps réel
docker compose logs -f discordbot

# Voir tous les logs
docker compose logs discordbot
```

**Option 3 : Utiliser Docker directement**
```bash
# Voir les dernières lignes
docker logs --tail=50 discordbot

# Suivre les logs en temps réel
docker logs -f discordbot
```

### Vérifier que le bot fonctionne
```bash
docker-compose ps
```

### Accéder au conteneur (pour debug)
```bash
docker-compose exec discordbot sh
```

### Redémarrer le bot après une modification
```bash
docker-compose restart discordbot
```

### Reconstruire et redémarrer après modification du code
```bash
docker-compose up -d --build
```

## Persistance des données

Le fichier `economy.json` est monté comme volume pour que les données persistent même si le conteneur est supprimé.

## Redémarrage automatique

Le conteneur est configuré avec `restart: unless-stopped`, ce qui signifie qu'il redémarrera automatiquement :
- Après un redémarrage du serveur
- Si le conteneur crash
- Si Docker redémarre

## Dépannage

### Le bot ne démarre pas
1. Vérifiez que le fichier `.env` existe et contient `DISCORD_TOKEN`
2. Vérifiez les logs : `./view-logs.sh` ou `docker compose logs discordbot`
3. Vérifiez que le port n'est pas déjà utilisé (si vous avez configuré un port)
4. Vérifiez l'état du conteneur : `docker compose ps`

### Les données ne persistent pas
1. Vérifiez que le volume est bien monté : `docker-compose ps -v`
2. Vérifiez les permissions du fichier `economy.json`

### Mettre à jour le bot
```bash
# Arrêter le bot
docker-compose down

# Mettre à jour le code (git pull, etc.)

# Reconstruire et redémarrer
docker-compose up -d --build
```

## Notes importantes

- Le bot fonctionnera 24/7 tant que Docker est en cours d'exécution
- Vous pouvez fermer votre éditeur/terminal, le bot continuera de fonctionner
- Les logs sont accessibles via `docker-compose logs`
- Le bot redémarrera automatiquement en cas de crash ou de redémarrage du serveur
