# Résultats des Tests de Configuration OAuth

## Tests effectués

### Test 1 : Configuration avec clientId et clientSecret
```yaml
oauth:
  enabled: true
  clientId: "..."
  clientSecret: "..."
  refreshToken: "..."
```
**Résultat** : ❌ Erreur 401 - Lavalink ne démarre pas

### Test 2 : Configuration minimale (sans clientId/clientSecret)
```yaml
oauth:
  enabled: true
  refreshToken: "..."
```
**Résultat** : ❌ Erreur 401 - Lavalink ne démarre pas

### Test 3 : Configuration avec skipInitialization
```yaml
oauth:
  enabled: true
  skipInitialization: true
```
**Résultat** : ✅ Lavalink démarre, mais l'API REST retourne toujours 401

### Test 4 : Configuration via API REST
```bash
curl -X POST http://localhost:2333/youtube \
  -H "Authorization: youshallnotpass" \
  -d '{"refreshToken": "..."}'
```
**Résultat** : ❌ Erreur 401 - Le refresh token ne peut pas être utilisé

## Constatations importantes

### 1. Le plugin a besoin de credentials OAuth
Même si `clientId` et `clientSecret` ne sont pas documentés comme options de configuration, le plugin semble en avoir besoin pour rafraîchir le token. Sans ces credentials, le plugin ne peut pas convertir le refresh token en access token.

### 2. skipInitialization permet au démarrage
Avec `skipInitialization: true`, Lavalink peut démarrer sans essayer d'initialiser OAuth immédiatement. Cependant, cela ne résout pas le problème fondamental : le plugin ne peut toujours pas utiliser le refresh token.

### 3. Le refresh token est valide
- ✅ Testé avec curl : Fonctionne parfaitement
- ✅ Stocké dans le plugin : GET /youtube retourne le token
- ❌ Utilisation par le plugin : Erreur 401

## Hypothèse sur le problème

Le plugin YouTube-Source semble avoir besoin des credentials OAuth (`clientId` et `clientSecret`) pour rafraîchir le token, mais :

1. **Ces options ne sont pas documentées** dans la configuration YAML
2. **Le plugin pourrait les obtenir d'une autre manière** (variables d'environnement, code source, etc.)
3. **Il pourrait y avoir un bug** dans la façon dont le plugin utilise ces credentials

## Options restantes

### Option 1 : Utiliser le flux OAuth interactif
Au lieu de fournir un refresh token, laisser le plugin générer un nouveau token via le flux OAuth interactif :

```yaml
oauth:
  enabled: true
  # Ne pas fournir de refreshToken
  # Le plugin affichera des instructions dans les logs
```

**Note** : Nécessite un accès interactif au terminal où Lavalink s'exécute.

### Option 2 : Vérifier les variables d'environnement
Le plugin pourrait lire `clientId` et `clientSecret` depuis des variables d'environnement. Vérifier dans le code source ou la documentation.

### Option 3 : Utiliser sans OAuth
Le bot fonctionne pour la plupart des vidéos YouTube publiques sans OAuth. OAuth n'est nécessaire que pour :
- Vidéos nécessitant une authentification
- Vidéos restreintes par région
- Playlists privées

### Option 4 : Créer une issue GitHub
Documenter le problème avec tous les détails pour que les mainteneurs puissent le corriger.

## Configuration recommandée (sans OAuth)

```yaml
plugins:
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: true
    allowPlaylists: true
    allowChannels: true
    # OAuth désactivé - fonctionne pour la plupart des vidéos publiques
    oauth:
      enabled: false
```

## Configuration recommandée (si OAuth est nécessaire)

```yaml
plugins:
  youtube:
    enabled: true
    oauth:
      enabled: true
      skipInitialization: true  # Permet à Lavalink de démarrer
      # Essayer le flux OAuth interactif pour générer un nouveau token
```

Puis suivre les instructions dans les logs pour compléter le flux OAuth.

## Conclusion

Le problème OAuth 401 persiste avec toutes les configurations testées. Le plugin semble avoir besoin de `clientId` et `clientSecret` pour fonctionner, mais ces options ne sont pas documentées et ne fonctionnent pas correctement dans la configuration YAML.

**Recommandation** : Utiliser le bot sans OAuth pour l'instant, ou essayer le flux OAuth interactif pour générer un nouveau token directement via le plugin.
