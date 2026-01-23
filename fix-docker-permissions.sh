#!/bin/bash

# Script pour corriger les permissions Docker

echo "🔧 Correction des permissions Docker..."

# Vérifier si l'utilisateur est dans le groupe docker
if groups | grep -q docker; then
    echo "✅ Vous êtes déjà dans le groupe docker"
else
    echo "📦 Ajout de l'utilisateur au groupe docker..."
    sudo usermod -aG docker $USER
    echo "✅ Utilisateur ajouté au groupe docker"
fi

echo ""
echo "⚠️  IMPORTANT: Les changements de groupe nécessitent une nouvelle session."
echo ""
echo "📋 Options pour activer les permissions:"
echo "   1. Déconnectez-vous et reconnectez-vous (recommandé)"
echo "   2. Utilisez: newgrp docker"
echo "   3. Ouvrez un nouveau terminal"
echo ""
echo "💡 Après cela, vous pourrez utiliser Docker sans sudo!"
