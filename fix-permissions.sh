#!/bin/bash

# Script pour configurer les permissions de l'utilisateur
# Ce script configure les permissions nécessaires sans donner root permanent

echo "🔧 Configuration des permissions utilisateur"
echo "=============================================="
echo ""

# Vérifier si l'utilisateur est root
if [ "$EUID" -eq 0 ]; then 
   echo "❌ Ne pas exécuter ce script en tant que root !"
   echo "💡 Exécutez-le avec votre utilisateur normal"
   exit 1
fi

echo "📋 Vérification des groupes actuels..."
CURRENT_USER=$(whoami)
echo "Utilisateur: $CURRENT_USER"
echo "Groupes actuels: $(groups)"
echo ""

# Ajouter au groupe docker si pas déjà membre
if groups | grep -q "\bdocker\b"; then
    echo "✅ Déjà membre du groupe docker"
else
    echo "➕ Ajout au groupe docker..."
    sudo usermod -aG docker $CURRENT_USER
    echo "✅ Ajouté au groupe docker"
    echo "⚠️  Vous devez vous déconnecter et reconnecter pour que les changements prennent effet"
    echo "   Ou exécutez: newgrp docker"
fi

# Vérifier les permissions du socket Docker
if [ -e /var/run/docker.sock ]; then
    DOCKER_GROUP=$(stat -c '%G' /var/run/docker.sock)
    if [ "$DOCKER_GROUP" = "docker" ]; then
        echo "✅ Socket Docker correctement configuré"
    else
        echo "⚠️  Socket Docker appartient au groupe: $DOCKER_GROUP"
    fi
fi

echo ""
echo "📝 Résumé:"
echo "   - Groupe sudo: ✅ (déjà membre)"
echo "   - Groupe docker: $(groups | grep -q '\bdocker\b' && echo '✅' || echo '⚠️  Reconnectez-vous')"
echo ""
echo "💡 Pour appliquer les changements immédiatement:"
echo "   newgrp docker"
echo ""
echo "💡 Ou déconnectez-vous et reconnectez-vous"
