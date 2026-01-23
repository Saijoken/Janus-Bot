#!/bin/bash

# Script d'installation de Docker et Docker Compose pour Ubuntu

echo "🐳 Installation de Docker et Docker Compose..."

# Vérifier si déjà installé
if command -v docker &> /dev/null; then
    echo "✅ Docker est déjà installé!"
    docker --version
else
    echo "📦 Installation de Docker..."
    
    # Mettre à jour les paquets
    sudo apt-get update
    
    # Installer les dépendances
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Ajouter la clé GPG officielle de Docker
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Ajouter le dépôt Docker
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Installer Docker
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Ajouter l'utilisateur actuel au groupe docker (pour éviter d'utiliser sudo)
    sudo usermod -aG docker $USER
    
    echo "✅ Docker installé avec succès!"
    echo "⚠️  Vous devez vous déconnecter et reconnecter (ou redémarrer) pour que les changements de groupe prennent effet."
fi

# Vérifier Docker Compose
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo "✅ Docker Compose est déjà installé!"
    if command -v docker-compose &> /dev/null; then
        docker-compose --version
    else
        docker compose version
    fi
else
    echo "📦 Docker Compose est inclus avec Docker (plugin)"
    docker compose version
fi

echo ""
echo "✅ Installation terminée!"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Si vous venez d'installer Docker, déconnectez-vous et reconnectez-vous"
echo "  2. Vérifiez l'installation: docker --version"
echo "  3. Testez Docker: docker run hello-world"
echo "  4. Lancez le bot: ./start-docker.sh"
