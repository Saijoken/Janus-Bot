#!/bin/bash
# Script to download YouTube plugin for Lavalink

PLUGINS_DIR="./lavalink/plugins"
PLUGIN_URL="https://github.com/lavalink-devs/youtube-source/releases/download/v1.16.0/youtube-source-1.16.0.jar"
PLUGIN_FILE="$PLUGINS_DIR/youtube-source.jar"

echo "📥 Téléchargement du plugin YouTube pour Lavalink..."

mkdir -p "$PLUGINS_DIR"

# Try multiple methods to download
if command -v curl &> /dev/null; then
    curl -L -f "$PLUGIN_URL" -o "$PLUGIN_FILE" || {
        echo "❌ Échec du téléchargement avec curl"
        exit 1
    }
elif command -v wget &> /dev/null; then
    wget "$PLUGIN_URL" -O "$PLUGIN_FILE" || {
        echo "❌ Échec du téléchargement avec wget"
        exit 1
    }
else
    echo "❌ curl ou wget requis pour télécharger le plugin"
    exit 1
fi

if [ -f "$PLUGIN_FILE" ] && [ -s "$PLUGIN_FILE" ]; then
    echo "✅ Plugin YouTube téléchargé avec succès: $PLUGIN_FILE"
    ls -lh "$PLUGIN_FILE"
else
    echo "❌ Le fichier téléchargé est vide ou invalide"
    exit 1
fi
