#!/bin/bash

# Script pour exécuter la migration complète vers PostgreSQL

echo "🚀 Migration vers PostgreSQL"
echo "=============================="
echo ""

# Vérifier si PostgreSQL est installé
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL n'est pas installé"
    echo "💡 Exécutez d'abord: ./setup-postgresql.sh"
    exit 1
fi

# Vérifier si le service PostgreSQL est actif
if ! sudo systemctl is-active --quiet postgresql; then
    echo "⚠️  Démarrage du service PostgreSQL..."
    sudo systemctl start postgresql
fi

# Vérifier si le fichier .env existe
if [ ! -f .env ]; then
    echo "❌ Le fichier .env n'existe pas!"
    echo "📝 Créez un fichier .env avec les variables DB_*"
    exit 1
fi

# Vérifier les variables d'environnement
if ! grep -q "DB_HOST" .env || ! grep -q "DB_NAME" .env; then
    echo "⚠️  Les variables DB_* ne sont pas définies dans .env"
    echo "📝 Ajoutez:"
    echo "   DB_HOST=localhost"
    echo "   DB_PORT=5432"
    echo "   DB_NAME=discordbot"
    echo "   DB_USER=discordbot_user"
    echo "   DB_PASSWORD=discordbot_password"
    echo ""
    read -p "Continuer quand même? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📋 Étapes de migration:"
echo "   1. Réinitialisation des achievements de pêche"
echo "   2. Création du schéma PostgreSQL"
echo "   3. Migration des données"
echo ""

read -p "⚠️  Cette opération va réinitialiser les achievements de pêche pour TOUS les utilisateurs. Continuer? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration annulée"
    exit 1
fi

echo ""
echo "🔄 Exécution de la migration..."
node migrate-to-postgresql.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration terminée avec succès!"
    echo ""
    echo "📋 Prochaines étapes:"
    echo "   1. Vérifiez que database.js utilise PostgreSQL (déjà fait)"
    echo "   2. Redémarrez le bot: docker compose restart"
    echo "   3. Testez les commandes pour vérifier que tout fonctionne"
else
    echo ""
    echo "❌ Erreur lors de la migration"
    exit 1
fi
