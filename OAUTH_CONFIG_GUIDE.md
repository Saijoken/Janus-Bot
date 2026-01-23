# Guide de Configuration OAuth pour YouTube-Source

## Architecture OAuth

L'architecture OAuth est structurée de manière modulaire dans `lavalink/application.yml` :

```yaml
plugins:
  youtube:
    oauth:
      enabled: false          # Activer/désactiver OAuth
      clientId: ""            # Client ID Google OAuth
      clientSecret: ""        # Client Secret Google OAuth
      refreshToken: ""         # Refresh Token OAuth
      skipInitialization: false  # Ignorer les erreurs OAuth au démarrage
```

## Configuration Rapide

### Étape 1 : Obtenir les identifiants OAuth

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un projet ou sélectionnez-en un existant
3. Activez **YouTube Data API v3**
4. Créez des identifiants OAuth 2.0 :
   - **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth client ID**
   - Type : **Desktop app** ou **Web application**
   - **Authorized redirect URI** : `http://localhost:8080/oauth2callback`
5. Configurez l'écran de consentement OAuth :
   - Ajoutez votre email comme **Test User**
   - Ajoutez le scope : `https://www.googleapis.com/auth/youtube.readonly`

### Étape 2 : Générer le Refresh Token

```bash
python3 get_youtube_token.py
```

Suivez les instructions pour :
1. Entrer votre Client ID et Client Secret
2. Ouvrir l'URL d'autorisation dans votre navigateur
3. Autoriser l'application
4. Copier le code d'autorisation
5. Obtenir le refresh token

### Étape 3 : Configurer application.yml

Éditez `lavalink/application.yml` et remplissez les valeurs :

```yaml
plugins:
  youtube:
    oauth:
      enabled: true
      clientId: "VOTRE_CLIENT_ID"
      clientSecret: "VOTRE_CLIENT_SECRET"
      refreshToken: "VOTRE_REFRESH_TOKEN"
      skipInitialization: false
```

### Étape 4 : Redémarrer Lavalink

```bash
docker compose restart lavalink
```

## Options de Configuration

### `enabled: true/false`
- **true** : Active OAuth pour les vidéos nécessitant une authentification
- **false** : Désactive OAuth (la plupart des vidéos publiques fonctionnent sans)

### `skipInitialization: true/false`
- **true** : Permet à Lavalink de démarrer même si OAuth échoue (utile pour le développement)
- **false** : Lavalink échouera au démarrage si OAuth est invalide (recommandé en production)

## Dépannage

### Erreur 401 : Invalid status code for oauth2 token fetch
- **Cause** : Refresh token invalide ou expiré
- **Solution** : Régénérez le refresh token avec `get_youtube_token.py`

### Erreur : Access Denied
- **Cause** : Votre compte n'est pas autorisé
- **Solution** : Ajoutez votre compte comme Test User dans Google Cloud Console

### Erreur : Invalid client
- **Cause** : Client ID ou Client Secret incorrect
- **Solution** : Vérifiez les identifiants dans Google Cloud Console

## Structure des Fichiers

```
discordbot/
├── lavalink/
│   ├── application.yml          # Configuration principale (à modifier)
│   └── application.yml.template  # Template de référence
├── get_youtube_token.py         # Script pour générer le refresh token
├── YOUTUBE_OAUTH_SETUP.md       # Guide détaillé
└── OAUTH_CONFIG_GUIDE.md        # Ce fichier
```

## Variables d'Environnement (Alternative)

Si vous préférez utiliser des variables d'environnement, vous pouvez modifier `docker-compose.yml` :

```yaml
lavalink:
  environment:
    - YOUTUBE_OAUTH_ENABLED=true
    - YOUTUBE_OAUTH_CLIENT_ID=your_client_id
    - YOUTUBE_OAUTH_CLIENT_SECRET=your_client_secret
    - YOUTUBE_OAUTH_REFRESH_TOKEN=your_refresh_token
```

Puis dans `application.yml`, utilisez :
```yaml
oauth:
  enabled: ${YOUTUBE_OAUTH_ENABLED:false}
  clientId: ${YOUTUBE_OAUTH_CLIENT_ID:}
  clientSecret: ${YOUTUBE_OAUTH_CLIENT_SECRET:}
  refreshToken: ${YOUTUBE_OAUTH_REFRESH_TOKEN:}
```

## Notes Importantes

- ⚠️ **Sécurité** : Ne partagez jamais vos identifiants OAuth publiquement
- 🔄 **Expiration** : Les refresh tokens peuvent expirer après 6 mois d'inutilisation
- 📊 **Quotas** : YouTube Data API a des limites (10,000 unités/jour par défaut)
- 🧪 **Test** : Utilisez `skipInitialization: true` pour tester sans OAuth valide
