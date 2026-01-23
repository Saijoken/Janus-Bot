# Options de Configuration OAuth - YouTube-Source Plugin

## Documentation officielle

Source : [GitHub - lavalink-devs/youtube-source README](https://github.com/lavalink-devs/youtube-source)

## Configuration OAuth de base

### Configuration minimale

```yaml
plugins:
  youtube:
    enabled: true
    oauth:
      enabled: true  # ⚠️ Minimum requis pour activer OAuth
```

### Configuration complète avec refresh token

```yaml
plugins:
  youtube:
    enabled: true
    oauth:
      enabled: true
      # Si vous avez un refresh token, vous pouvez le définir ci-dessous
      # Définir un refresh token valide ignorera complètement le flux OAuth
      refreshToken: "votre refresh token ici"
      
      # Définir ceci si vous ne voulez pas que le flux OAuth soit déclenché,
      # si vous prévoyez de fournir un refresh token plus tard.
      # L'initialisation est ignorée automatiquement si un refresh token valide est fourni.
      # Laissez ceci commenté si vous complétez le flux OAuth pour la première fois
      # ou si vous n'avez pas de refresh token.
      # skipInitialization: true
```

## Options de configuration disponibles

### 1. `enabled: true/false`
- **Requis** : Oui (minimum pour activer OAuth)
- **Description** : Active ou désactive l'intégration OAuth
- **Note** : C'est le minimum requis pour que OAuth fonctionne

### 2. `refreshToken: "string"`
- **Requis** : Non (mais recommandé si vous avez déjà un token)
- **Description** : Fournit un refresh token existant
- **Effet** : Ignore complètement le flux OAuth interactif
- **Important** : Si le token est valide, le flux OAuth ne sera pas déclenché

### 3. `skipInitialization: true/false`
- **Requis** : Non
- **Description** : Ignore l'initialisation OAuth si vous prévoyez de fournir un refresh token plus tard
- **Note** : Ignoré automatiquement si un refresh token valide est fourni
- **Usage** : Utile si vous voulez configurer OAuth plus tard via l'API REST

### 4. `clientId: "string"` (optionnel dans la doc)
- **Note** : Non mentionné dans la documentation officielle comme option de configuration
- **Usage actuel** : Utilisé dans votre configuration mais peut-être pas nécessaire

### 5. `clientSecret: "string"` (optionnel dans la doc)
- **Note** : Non mentionné dans la documentation officielle comme option de configuration
- **Usage actuel** : Utilisé dans votre configuration mais peut-être pas nécessaire

## Méthode alternative : Passer un token OAuth depuis le client

Au lieu de configurer OAuth dans `application.yml`, vous pouvez passer un token OAuth depuis votre bot Discord via le champ `userData` lors de la lecture d'une piste :

```json
{
  "oauth-token": "access token à utiliser"
}
```

Cette méthode permet de gérer les tokens OAuth côté client plutôt que côté Lavalink.

## API REST pour la configuration OAuth

Le plugin expose des routes REST pour gérer OAuth dynamiquement :

### POST /youtube
Mettre à jour la configuration OAuth :

```json
{
  "refreshToken": "votre nouveau refresh token",
  "skipInitialization": true
}
```

### GET /youtube
Récupérer le refresh token actuel :

```json
{
  "refreshToken": "votre refresh token actuel, ou null"
}
```

### GET /youtube/oauth/{refreshToken}
Tester si un refresh token est valide et obtenir un access token :

```json
{
  "access_token": "AccessToken",
  "expires_in": 69420,
  "scope": "scope utilisé",
  "token_type": "type"
}
```

## Configuration actuelle vs Documentation

### Ce que vous avez actuellement :

```yaml
oauth:
  enabled: true
  clientId: "651727633861-1to9tvl8f356d1bab1v54sgqtqkm1olv.apps.googleusercontent.com"
  clientSecret: "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"
  refreshToken: "1//03lAwfSJBHo2pCgYIARAAGAMSNwF-L9IrsGXfNlQLJuAynHcGXEZHcxhGKDPFQ2ElZiIZswR8UJMWHey__K7kSMxKL2vWleOTWbY"
```

### Ce que la documentation suggère :

```yaml
oauth:
  enabled: true
  refreshToken: "votre refresh token ici"
  # skipInitialization: true  # Optionnel
```

**Différence clé** : La documentation ne mentionne **PAS** `clientId` et `clientSecret` comme options de configuration dans `application.yml`.

## Hypothèse sur le problème

Le problème 401 pourrait être causé par :
1. **clientId et clientSecret non supportés** : Ces options ne sont peut-être pas reconnues par le plugin
2. **Format de configuration incorrect** : Le plugin pourrait s'attendre à un format différent
3. **Le plugin utilise peut-être un mécanisme interne** pour obtenir les credentials OAuth

## Options à tester

### Option 1 : Configuration minimale (sans clientId/clientSecret)

```yaml
plugins:
  youtube:
    enabled: true
    oauth:
      enabled: true
      refreshToken: "1//03lAwfSJBHo2pCgYIARAAGAMSNwF-L9IrsGXfNlQLJuAynHcGXEZHcxhGKDPFQ2ElZiIZswR8UJMWHey__K7kSMxKL2vWleOTWbY"
```

### Option 2 : Avec skipInitialization

```yaml
plugins:
  youtube:
    enabled: true
    oauth:
      enabled: true
      refreshToken: "1//03lAwfSJBHo2pCgYIARAAGAMSNwF-L9IrsGXfNlQLJuAynHcGXEZHcxhGKDPFQ2ElZiIZswR8UJMWHey__K7kSMxKL2vWleOTWbY"
      skipInitialization: true
```

### Option 3 : Configuration via API REST

Au lieu de configurer dans `application.yml`, utiliser l'API REST après le démarrage de Lavalink :

```bash
curl -X POST http://localhost:2333/youtube \
  -H "Content-Type: application/json" \
  -H "Authorization: youshallnotpass" \
  -d '{
    "refreshToken": "1//03lAwfSJBHo2pCgYIARAAGAMSNwF-L9IrsGXfNlQLJuAynHcGXEZHcxhGKDPFQ2ElZiIZswR8UJMWHey__K7kSMxKL2vWleOTWbY"
  }'
```

## Notes importantes de la documentation

1. **Warning** : L'utilisation d'OAuth n'est pas une solution miracle et pourrait entraîner la suspension de votre compte YouTube si utilisé de manière abusive. Utilisez des comptes de test, pas votre compte principal !

2. **Logging** : Pour voir des informations supplémentaires sur le flux OAuth, configurez le niveau de log :
   ```yaml
   logging:
     level:
       dev.lavalink.youtube.http.YoutubeOauth2Handler: INFO
   ```

3. **Obtention du refresh token** : Si vous n'avez pas de refresh token, ne le fournissez pas. Le plugin affichera le refresh token dans le terminal après avoir complété le flux OAuth au moins une fois.

4. **PoToken vs OAuth** : Vous n'avez pas besoin d'utiliser `poToken` avec OAuth, et vice versa.

## Prochaines étapes recommandées

1. ✅ Tester la configuration minimale (sans clientId/clientSecret)
2. ✅ Tester avec `skipInitialization: true`
3. ✅ Tester la configuration via API REST après le démarrage
4. ✅ Vérifier les logs avec le niveau INFO pour `YoutubeOauth2Handler`
