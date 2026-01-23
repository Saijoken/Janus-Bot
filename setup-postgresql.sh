#!/bin/bash

# Script pour installer et configurer PostgreSQL

echo "🐘 Installation et configuration de PostgreSQL..."

# Install PostgreSQL if not installed
if ! command -v psql &> /dev/null; then
    echo "📦 Installation de PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    echo "✅ PostgreSQL installé"
else
    echo "✅ PostgreSQL est déjà installé"
fi

# Start PostgreSQL service
echo "🚀 Démarrage du service PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
echo "📋 Création de la base de données et de l'utilisateur..."
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE discordbot;

-- Create user
CREATE USER discordbot_user WITH PASSWORD 'discordbot_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE discordbot TO discordbot_user;

-- Connect to database and grant schema privileges
\c discordbot
GRANT ALL ON SCHEMA public TO discordbot_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO discordbot_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO discordbot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO discordbot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO discordbot_user;
EOF

echo "✅ Base de données créée"
echo ""
echo "📝 Configuration PostgreSQL:"
echo "   Database: discordbot"
echo "   User: discordbot_user"
echo "   Password: discordbot_password"
echo ""
echo "⚠️  N'oubliez pas d'ajouter ces variables dans votre fichier .env:"
echo "   DB_HOST=localhost"
echo "   DB_PORT=5432"
echo "   DB_NAME=discordbot"
echo "   DB_USER=discordbot_user"
echo "   DB_PASSWORD=discordbot_password"
