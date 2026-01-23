# Configuration OAuth avec Device Code

## Code OAuth actuel

Le plugin a généré un code OAuth. Pour compléter le flux :

1. **Allez sur** : https://www.google.com/device
2. **Entrez le code** affiché dans les logs Lavalink
3. **Autorisez l'application** avec un compte de test (⚠️ NE PAS utiliser votre compte principal)

## Code actuel dans les logs

Le code change à chaque redémarrage. Vérifiez les logs avec :

```bash
docker compose logs lavalink | grep "enter code"
```

## Configuration requise

Pour que OAuth fonctionne, vous devez :

1. ✅ Activer OAuth : `oauth.enabled: true`
2. ✅ Configurer les clients compatibles OAuth : `TV` et `TVHTML5EMBEDDED`
3. ✅ Compléter le flux OAuth avec le code device

## Clients compatibles OAuth

D'après la documentation, les clients compatibles OAuth sont :
- `TV` - Requiert OAuth pour la lecture
- `TVHTML5EMBEDDED` - Requiert OAuth pour la lecture

Ces clients doivent être dans la liste `clients` dans `application.yml`.

## Après avoir complété le flux OAuth

Une fois le flux OAuth complété, le plugin affichera le refresh token dans les logs. Vous pouvez ensuite :

1. Copier le refresh token
2. L'ajouter dans `application.yml` :
   ```yaml
   oauth:
     enabled: true
     refreshToken: "votre_refresh_token_ici"
   ```
3. Redémarrer Lavalink

Cela évitera de devoir compléter le flux OAuth à chaque redémarrage.
