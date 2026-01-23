# OAuth : Curl fonctionne mais Lavalink échoue

## Situation

✅ **Le refresh token est VALIDE** - Testé avec curl :
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=..." \
  -d "client_secret=..." \
  -d "refresh_token=..." \
  -d "grant_type=refresh_token"
```

**Résultat** : Succès - `access_token` généré correctement

❌ **Mais Lavalink échoue** avec l'erreur :
```
java.io.IOException: Invalid status code for oauth2 token fetch: 401
```

## Analyse

Le refresh token fonctionne avec l'API Google OAuth directement, mais le plugin YouTube-Source de Lavalink obtient une erreur 401 lors de l'initialisation.

### Causes possibles

1. **Format de requête différent** : Le plugin pourrait utiliser un format de requête différent que curl
2. **En-têtes HTTP manquants** : Le plugin pourrait ne pas envoyer les bons en-têtes
3. **Problème de timing** : Le plugin pourrait essayer d'utiliser le token avant qu'il ne soit complètement initialisé
4. **Bug du plugin** : Il pourrait y avoir un bug connu dans la version 1.16.0 du plugin
5. **Configuration manquante** : Il pourrait manquer une configuration dans `application.yml`

## Solutions à essayer

### Solution 1 : Vérifier la version du plugin

Vérifiez que vous utilisez la dernière version du plugin YouTube-Source :
- Version actuelle : `youtube-plugin-1.16.0.jar`
- Dernière version : Vérifiez sur [GitHub Releases](https://github.com/lavalink-devs/youtube-source/releases)

### Solution 2 : Désactiver OAuth temporairement

Le bot fonctionnera pour la plupart des vidéos YouTube publiques sans OAuth :

```yaml
plugins:
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: true
    allowPlaylists: true
    allowChannels: true
    oauth:
      enabled: false  # Désactivé jusqu'à résolution du problème
```

### Solution 3 : Vérifier les issues GitHub

Consultez les issues GitHub du plugin pour voir si d'autres utilisateurs ont le même problème :
- [youtube-source Issues](https://github.com/lavalink-devs/youtube-source/issues)

### Solution 4 : Régénérer le refresh token

Parfois, régénérer le token avec le script Python peut résoudre le problème :

```bash
python3 get_youtube_token.py
```

**Important** : Utilisez le même compte Google que celui utilisé pour créer les identifiants OAuth.

### Solution 5 : Vérifier les logs détaillés

Avec le logging DEBUG activé dans `application.yml` :

```yaml
logging:
  level:
    dev.lavalink.youtube: DEBUG
```

Les logs devraient montrer plus de détails sur la requête OAuth qui échoue.

## État actuel

- ✅ Refresh token valide (testé avec curl)
- ❌ Lavalink ne peut pas démarrer avec OAuth activé
- ✅ Le bot fonctionne sans OAuth pour les vidéos publiques
- ⚠️ OAuth est actuellement désactivé pour permettre à Lavalink de démarrer

## Recommandation

Pour l'instant, **laissez OAuth désactivé**. Le bot fonctionnera pour la plupart des vidéos YouTube publiques. OAuth n'est nécessaire que pour :
- Les vidéos nécessitant une authentification
- Certaines vidéos restreintes par région
- Les playlists privées

Si vous avez besoin d'OAuth, consultez les issues GitHub du plugin ou essayez de régénérer le refresh token.
