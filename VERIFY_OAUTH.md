# Vérification et Régénération du Refresh Token OAuth

## Problème : Erreur 401 "Invalid status code for oauth2 token fetch"

Cette erreur signifie que le refresh token est invalide, expiré, ou que les identifiants OAuth sont incorrects.

## Solution : Régénérer le Refresh Token

### Étape 1 : Vérifier les identifiants OAuth

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. Allez dans **APIs & Services** > **Credentials**
4. Vérifiez que votre **Client ID** et **Client Secret** sont corrects

### Étape 2 : Régénérer le Refresh Token

Exécutez le script Python :

```bash
python3 get_youtube_token.py
```

**Important** : 
- Utilisez le **même compte Google** que celui utilisé pour créer les identifiants OAuth
- Assurez-vous que votre compte est ajouté comme **Test User** dans OAuth consent screen
- Si vous obtenez une erreur "Access Denied", ajoutez votre compte dans **OAuth consent screen** > **Test users**

### Étape 3 : Vérifier le Refresh Token

Le refresh token doit :
- Commencer par `1//` (format Google OAuth)
- Être une longue chaîne de caractères
- Avoir été généré récemment (les tokens peuvent expirer après 6 mois d'inutilisation)

### Étape 4 : Mettre à jour application.yml

Une fois le nouveau refresh token obtenu, mettez à jour `lavalink/application.yml` :

```yaml
oauth:
  enabled: true
  clientId: "VOTRE_CLIENT_ID"
  clientSecret: "VOTRE_CLIENT_SECRET"
  refreshToken: "NOUVEAU_REFRESH_TOKEN"
```

### Étape 5 : Redémarrer Lavalink

```bash
docker compose restart lavalink
```

## Alternative : Désactiver OAuth temporairement

Si vous n'avez pas besoin de lire les vidéos qui nécessitent une connexion, vous pouvez laisser OAuth désactivé. Le plugin YouTube-Source fonctionnera toujours pour la plupart des vidéos publiques.

Pour désactiver OAuth, commentez la section dans `application.yml` :

```yaml
# oauth:
#   enabled: true
#   ...
```

## Dépannage

- **401 Unauthorized** : Refresh token invalide ou expiré → Régénérez-le
- **Access Denied** : Compte non autorisé → Ajoutez-le comme Test User
- **Invalid client** : Client ID ou Secret incorrect → Vérifiez dans Google Cloud Console
