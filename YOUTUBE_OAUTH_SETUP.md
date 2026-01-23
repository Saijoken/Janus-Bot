# Configuration OAuth pour YouTube-Source Plugin

Ce guide explique comment configurer OAuth pour le plugin YouTube-Source afin de pouvoir lire les vidéos YouTube qui nécessitent une authentification.

## Prérequis

1. Un compte Google
2. Accès à Google Cloud Console

## Étape 1 : Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Notez le nom du projet

## Étape 2 : Activer YouTube Data API v3

1. Dans Google Cloud Console, allez dans **APIs & Services** > **Library**
2. Recherchez "YouTube Data API v3"
3. Cliquez sur **Enable**

## Étape 3 : Créer des identifiants OAuth 2.0

1. Allez dans **APIs & Services** > **Credentials**
2. Cliquez sur **Create Credentials** > **OAuth client ID**
3. Si c'est la première fois, configurez l'écran de consentement OAuth :
   - Choisissez **External** (ou Internal si vous avez Google Workspace)
   - Remplissez les informations requises
   - Ajoutez votre email comme test user
4. Pour le type d'application, choisissez **Desktop app** ou **Web application**
5. Donnez un nom à votre client OAuth
6. Pour **Authorized redirect URIs**, ajoutez : `http://localhost:8080/oauth2callback`
7. Cliquez sur **Create**
8. **IMPORTANT** : Copiez le **Client ID** et le **Client Secret** (vous ne pourrez plus voir le secret plus tard)

## Étape 4 : Obtenir un Refresh Token

### Option A : Utiliser un script Python (recommandé)

Créez un fichier `get_youtube_token.py` :

```python
import json
from urllib.parse import urlencode
import urllib.request

# Remplacez par vos identifiants
CLIENT_ID = "VOTRE_CLIENT_ID"
CLIENT_SECRET = "VOTRE_CLIENT_SECRET"

# Étape 1 : Obtenir l'URL d'autorisation
auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
params = {
    "client_id": CLIENT_ID,
    "redirect_uri": "http://localhost:8080/oauth2callback",
    "response_type": "code",
    "scope": "https://www.googleapis.com/auth/youtube.readonly",
    "access_type": "offline",
    "prompt": "consent"
}

auth_full_url = f"{auth_url}?{urlencode(params)}"
print(f"\n1. Ouvrez cette URL dans votre navigateur :\n{auth_full_url}\n")
print("2. Connectez-vous avec votre compte Google")
print("3. Autorisez l'application")
print("4. Copiez le code d'autorisation depuis l'URL de redirection\n")

auth_code = input("Collez le code d'autorisation ici : ").strip()

# Étape 2 : Échanger le code contre un refresh token
token_url = "https://oauth2.googleapis.com/token"
data = {
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "code": auth_code,
    "grant_type": "authorization_code",
    "redirect_uri": "http://localhost:8080/oauth2callback"
}

req = urllib.request.Request(token_url, data=urlencode(data).encode())
response = urllib.request.urlopen(req)
token_data = json.loads(response.read().decode())

print(f"\n✅ Refresh Token obtenu :\n{token_data.get('refresh_token')}\n")
print("⚠️  Gardez ce token en sécurité !")
```

### Option B : Utiliser curl (alternative)

1. Ouvrez cette URL dans votre navigateur (remplacez `CLIENT_ID`):
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost:8080/oauth2callback&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly&access_type=offline&prompt=consent
```

2. Autorisez l'application et copiez le `code` depuis l'URL de redirection

3. Échangez le code contre un refresh token :
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=VOTRE_CLIENT_ID" \
  -d "client_secret=VOTRE_CLIENT_SECRET" \
  -d "code=CODE_OBTENU" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost:8080/oauth2callback"
```

## Étape 5 : Configurer application.yml

Ajoutez la configuration OAuth dans `lavalink/application.yml` :

```yaml
plugins:
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: true
    allowPlaylists: true
    allowChannels: true
    oauth:
      enabled: true
      clientId: "VOTRE_CLIENT_ID"
      clientSecret: "VOTRE_CLIENT_SECRET"
      refreshToken: "VOTRE_REFRESH_TOKEN"
```

## Étape 6 : Redémarrer Lavalink

```bash
docker compose restart lavalink
```

## Vérification

Vérifiez les logs Lavalink pour confirmer que OAuth est configuré :
```bash
docker compose logs lavalink | grep -i oauth
```

Vous devriez voir des messages indiquant que OAuth est initialisé.

## Notes importantes

- ⚠️ **Sécurité** : Ne partagez jamais votre Client Secret et Refresh Token
- 🔄 **Expiration** : Les refresh tokens peuvent expirer si non utilisés pendant 6 mois
- 📝 **Limites** : YouTube Data API a des quotas quotidiens (10,000 unités par défaut)
- 🔐 **Stockage** : Considérez utiliser des variables d'environnement pour les secrets

## Dépannage

- **"Invalid grant"** : Le refresh token a expiré, générez-en un nouveau
- **"Access denied"** : Vérifiez que YouTube Data API v3 est activé
- **"Invalid client"** : Vérifiez que Client ID et Secret sont corrects
