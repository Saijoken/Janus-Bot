#!/bin/bash

# Script de démarrage rapide pour le bot Discord
set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas installé${NC}"
    exit 1
fi

# Vérifier docker compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose n'est pas disponible${NC}"
    exit 1
fi

# Vérifier .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Fichier .env introuvable${NC}"
    echo "Création d'un fichier .env exemple..."
    cat > .env << EOF
DISCORD_TOKEN=votre_token_ici
COUNTER_CHANNEL_ID=votre_channel_id_ici
EOF
    echo -e "${YELLOW}⚠️  Veuillez configurer le fichier .env avant de continuer${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Démarrage du bot Discord...${NC}"

# Construire et démarrer
echo "📦 Construction des images..."
docker compose build --quiet

echo "▶️  Démarrage des services..."
docker compose up -d

echo ""
echo -e "${GREEN}✅ Bot démarré avec succès!${NC}"
echo ""
echo "📋 Commandes utiles:"
echo "  ./view-logs.sh -f    # Voir les logs en temps réel"
echo "  docker compose ps    # Voir le statut"
echo "  docker compose stop  # Arrêter"
echo "  docker compose restart # Redémarrer"
echo ""
echo "📊 Statut des services:"
docker compose ps
