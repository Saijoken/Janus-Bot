#!/bin/bash

# Script pour voir les logs du bot Discord en temps réel

echo "📋 Logs du bot Discord"
echo "======================"
echo ""
echo "Options:"
echo "  -f, --follow    Suivre les logs en temps réel (recommandé)"
echo "  -n, --tail N    Afficher les N dernières lignes (défaut: 50)"
echo "  --all           Afficher tous les logs depuis le début"
echo ""
echo "Exemples:"
echo "  ./view-logs.sh              # Dernières 50 lignes"
echo "  ./view-logs.sh -f           # Suivre en temps réel"
echo "  ./view-logs.sh -n 100       # Dernières 100 lignes"
echo "  ./view-logs.sh --all        # Tous les logs"
echo ""

# Vérifier si Docker est accessible
if ! sudo docker compose ps &> /dev/null; then
    echo "❌ Erreur: Docker n'est pas accessible"
    echo "💡 Essayez avec sudo: sudo docker compose logs"
    exit 1
fi

# Options par défaut
FOLLOW=false
TAIL=50
ALL=false

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--tail)
            TAIL="$2"
            shift 2
            ;;
        --all)
            ALL=true
            shift
            ;;
        *)
            echo "❌ Option inconnue: $1"
            exit 1
            ;;
    esac
done

# Construire la commande
if [ "$ALL" = true ]; then
    echo "📊 Affichage de tous les logs..."
    sudo docker compose logs discordbot
elif [ "$FOLLOW" = true ]; then
    echo "👀 Suivi des logs en temps réel (Ctrl+C pour quitter)..."
    echo ""
    sudo docker compose logs -f --tail=50 discordbot
else
    echo "📊 Dernières $TAIL lignes de logs..."
    echo ""
    sudo docker compose logs --tail=$TAIL discordbot
fi
