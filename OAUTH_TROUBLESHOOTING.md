# Dépannage OAuth - Erreur 401

## Problème
Lavalink ne démarre pas avec l'erreur : `Invalid status code for oauth2 token fetch: 401`

## Causes possibles

### 1. Refresh Token invalide ou expiré
- Le refresh token a été révoqué
- Le refresh token a expiré (après 6 mois d'inutilisation)
- Le refresh token a été généré avec un autre compte Google

### 2. Client ID ou Client Secret incorrect
- Les identifiants ne correspondent pas à ceux dans Google Cloud Console
- Les identifiants ont été révoqués ou supprimés

### 3. Compte Google non autorisé
- Votre compte n'est pas ajouté comme Test User dans OAuth consent screen
- L'application OAuth n'est pas publiée et vous n'êtes pas dans la liste des test users

## Solution : Régénérer le Refresh Token

### Étape 1 : Vérifier Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. Vérifiez **APIs & Services** > **Credentials** :
   - Votre Client ID correspond à celui dans `application.yml`
   - Votre Client Secret correspond à celui dans `application.yml`
4. Vérifiez **APIs & Services** > **OAuth consent screen** :
   - Votre email est dans la liste des **Test users**
   - Si non, ajoutez-le et attendez 1-2 minutes

### Étape 2 : Générer un nouveau Refresh Token

```bash
python3 get_youtube_token.py
```

**IMPORTANT** :
- Utilisez le **même compte Google** que celui utilisé pour créer les identifiants OAuth
- Utilisez le **même compte** que celui ajouté comme Test User
- Si vous obtenez "Access Denied", attendez 1-2 minutes après avoir ajouté votre compte comme Test User

### Étape 3 : Vérifier le Refresh Token

Le refresh token doit :
- Commencer par `1//` (format Google OAuth 2.0)
- Être une longue chaîne (environ 100+ caractères)
- Avoir été généré récemment (moins de 6 mois)

### Étape 4 : Tester le Refresh Token

Vous pouvez tester si le refresh token est valide avec curl :

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=VOTRE_CLIENT_ID" \
  -d "client_secret=VOTRE_CLIENT_SECRET" \
  -d "refresh_token=VOTRE_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"
```

Si vous obtenez un `access_token` en réponse, le refresh token est valide.

### Étape 5 : Activer OAuth dans application.yml

Une fois le refresh token validé :

```yaml
oauth:
  enabled: true
  clientId: "VOTRE_CLIENT_ID"
  clientSecret: "VOTRE_CLIENT_SECRET"
  refreshToken: "VOTRE_REFRESH_TOKEN_VALIDE"
```

### Étape 6 : Redémarrer Lavalink

```bash
docker compose restart lavalink
```

## Alternative : Utiliser OAuth sans refresh token valide

Si vous ne pouvez pas obtenir un refresh token valide immédiatement, vous pouvez :

1. **Désactiver OAuth** : `enabled: false`
   - Le bot fonctionnera pour la plupart des vidéos YouTube publiques
   - Les vidéos nécessitant une authentification ne fonctionneront pas

2. **Configurer OAuth plus tard** quand vous aurez un refresh token valide

## Vérification

Après avoir activé OAuth avec un refresh token valide, vérifiez les logs :

```bash
docker compose logs lavalink | grep -i oauth
```

Vous devriez voir des messages indiquant que OAuth est initialisé avec succès, sans erreur 401.
