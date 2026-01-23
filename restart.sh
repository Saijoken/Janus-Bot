#!/bin/bash

# Script de redémarrage rapide pour le bot Discord
# Usage: ./restart.sh ou utiliser les alias: dcd, dcu, dr
set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

# Détecter l'action demandée via le nom du script ou argument
SCRIPT_NAME=$(basename "$0")
ACTION="${1:-restart}"
NO_CACHE="${2:-}"

case "$ACTION" in
    "down"|"dcd"|"stop")
        echo -e "${YELLOW}🛑 Arrêt des services...${NC}"
        docker compose down
        echo -e "${GREEN}✅ Services arrêtés${NC}"
        ;;
    "up"|"dcu"|"start")
        echo -e "${GREEN}🚀 Démarrage des services...${NC}"
        docker compose up -d
        echo ""
        echo -e "${GREEN}✅ Services démarrés!${NC}"
        echo ""
        echo "📊 Statut des services:"
        docker compose ps
        ;;
    "restart"|"dr"|*)
        echo -e "${BLUE}🔄 Redémarrage des services...${NC}"
        echo -e "${YELLOW}  → Arrêt...${NC}"
        docker compose down
        echo -e "${YELLOW}  → Reconstruction de l'image du bot (pour prendre en compte les changements)...${NC}"
        if [ "$NO_CACHE" = "--no-cache" ] || [ "$NO_CACHE" = "-nc" ]; then
            echo -e "${YELLOW}    (Reconstruction complète sans cache)...${NC}"
            docker compose build --no-cache discordbot
        else
            docker compose build discordbot
        fi
        echo -e "${GREEN}  → Démarrage...${NC}"
        docker compose up -d
        echo ""
        echo -e "${GREEN}✅ Services redémarrés avec succès!${NC}"
        echo ""
        echo "📋 Commandes utiles:"
        echo "  ./view-logs.sh -f         # Voir les logs en temps réel"
        echo "  docker compose ps         # Voir le statut"
        echo "  ./restart.sh --no-cache   # Rebuild complet sans cache"
        echo ""
        echo "📊 Statut des services:"
        docker compose ps
        ;;
esac
