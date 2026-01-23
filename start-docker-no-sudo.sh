#!/bin/bash

# Script wrapper qui active le groupe docker et lance start-docker.sh
# Ce script permet d'utiliser Docker sans sudo immédiatement

echo "🔧 Activation du groupe docker et démarrage du bot..."
echo ""

# Vérifier si l'utilisateur est dans le groupe docker
if ! groups | grep -q "\bdocker\b"; then
    echo "❌ Vous n'êtes pas dans le groupe docker!"
    echo "💡 Exécution de fix-permissions.sh..."
    if [ -f "./fix-permissions.sh" ]; then
        ./fix-permissions.sh
    else
        echo "➕ Ajout au groupe docker..."
        sudo usermod -aG docker $USER
        echo "✅ Ajouté au groupe docker!"
        echo "⚠️  Vous devez vous déconnecter et reconnecter pour que les changements prennent effet."
    fi
    exit 1
fi

# Utiliser newgrp pour activer le groupe docker dans un nouveau shell
# et exécuter start-docker.sh dans ce contexte
exec newgrp docker << EOF
cd "$(pwd)"
./start-docker.sh
EOF
