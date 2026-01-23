#!/bin/bash

# Script de démarrage rapide pour le bot Discord avec Docker

echo "🐳 Démarrage du bot Discord avec Docker..."

# Fonction pour vérifier l'accès Docker
check_docker_access() {
    if docker ps &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Vérifier l'accès Docker et configurer si nécessaire
if ! check_docker_access; then
    echo "⚠️  Problème d'accès à Docker détecté..."
    
    # Vérifier si l'utilisateur est dans le groupe docker
    if groups | grep -q "\bdocker\b"; then
        echo "✅ Vous êtes dans le groupe docker, mais la session n'est pas à jour."
        echo "🔄 Tentative d'activation du groupe docker..."
        
        # Essayer d'utiliser sg (substitute group) pour exécuter dans le contexte du groupe docker
        if command -v sg &> /dev/null; then
            echo "💡 Utilisation de 'sg docker' pour exécuter les commandes..."
            exec sg docker "$0" "$@"
        else
            echo "❌ 'sg' n'est pas disponible. Utilisation de sudo temporairement..."
            echo "💡 Pour éviter sudo à l'avenir, exécutez: newgrp docker"
            DOCKER_SUDO="sudo"
        fi
    else
        echo "➕ Ajout au groupe docker..."
        sudo usermod -aG docker $USER
        echo "✅ Ajouté au groupe docker!"
        echo ""
        echo "⚠️  IMPORTANT: Vous devez vous déconnecter et reconnecter pour que les changements prennent effet."
        echo "   Ou exécutez: newgrp docker"
        echo ""
        echo "💡 En attendant, le script utilisera sudo pour cette exécution..."
        DOCKER_SUDO="sudo"
    fi
else
    DOCKER_SUDO=""
    echo "✅ Accès Docker OK"
fi

# Vérifier si .env existe
if [ ! -f .env ]; then
    echo "❌ Erreur: Le fichier .env n'existe pas!"
    echo "📝 Créez un fichier .env avec DISCORD_TOKEN et COUNTER_CHANNEL_ID (optionnel)"
    exit 1
fi

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Erreur: Docker n'est pas installé!"
    echo ""
    echo "💡 Voulez-vous installer Docker maintenant? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "📦 Installation de Docker..."
        if [ -f "./install-docker.sh" ]; then
            ./install-docker.sh
        else
            echo "❌ Le script install-docker.sh n'existe pas!"
            echo "📝 Veuillez installer Docker manuellement:"
            echo "   curl -fsSL https://get.docker.com -o get-docker.sh"
            echo "   sudo sh get-docker.sh"
            exit 1
        fi
        echo ""
        echo "⚠️  Vous devez vous déconnecter et reconnecter après l'installation de Docker."
        echo "   Ensuite, relancez ce script: ./start-docker.sh"
        exit 0
    else
        echo "❌ Docker est requis pour continuer."
        exit 1
    fi
fi

# Vérifier si Docker Compose est disponible (plugin intégré ou standalone)
if ! $DOCKER_SUDO docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "❌ Erreur: Docker Compose n'est pas disponible!"
    exit 1
fi

# Utiliser docker compose (plugin) si disponible, sinon docker-compose (standalone)
if $DOCKER_SUDO docker compose version &> /dev/null; then
    DOCKER_COMPOSE="$DOCKER_SUDO docker compose"
else
    DOCKER_COMPOSE="$DOCKER_SUDO docker-compose"
fi

# Construire et démarrer le conteneur
echo "🔨 Construction de l'image Docker..."
$DOCKER_COMPOSE build

echo "🚀 Démarrage du bot..."
$DOCKER_COMPOSE up -d

echo "✅ Bot démarré!"
echo ""
echo "📋 Commandes utiles:"
if [ -n "$DOCKER_SUDO" ]; then
    echo "  - Voir les logs: $DOCKER_COMPOSE logs -f"
    echo "  - Arrêter le bot: $DOCKER_COMPOSE down"
    echo "  - Redémarrer: $DOCKER_COMPOSE restart"
    echo ""
    echo "💡 Pour éviter sudo, reconnectez-vous ou exécutez: newgrp docker"
else
    echo "  - Voir les logs: $DOCKER_COMPOSE logs -f"
    echo "  - Arrêter le bot: $DOCKER_COMPOSE down"
    echo "  - Redémarrer: $DOCKER_COMPOSE restart"
fi
echo ""
echo "📊 Statut du conteneur:"
$DOCKER_COMPOSE ps
