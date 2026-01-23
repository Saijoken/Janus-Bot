# Analyse des Issues GitHub - YouTube-Source Plugin

## Recherche effectuée

J'ai recherché les issues GitHub du plugin YouTube-Source concernant les problèmes OAuth et les erreurs 401.

## Issues pertinents trouvés

### Issue #161 : "Clean Refresh token and Oauth passed, but 'Sign in Required' 1.13.3"
- **Statut** : Closed (Not planned - skipped)
- **Date** : Juillet 2025
- **Description** : Un utilisateur avait un refresh token propre et OAuth configuré, mais obtenait toujours "Sign in Required"
- **Résolution** : L'issue a été fermée comme "Not planned", suggérant que le problème n'a pas été résolu ou n'est pas considéré comme prioritaire

### Issue #14 : "YouTube: Sign in to confirm you're not a bot"
- **Statut** : Closed
- **Date** : Mai 2024
- **Description** : YouTube détecte et bloque les requêtes, même avec rotation d'IP
- **Note** : Problème général d'authentification YouTube, pas spécifiquement OAuth 401

### Issues liés à OAuth (recherche "oauth")
- **Issue #188** : "Show all client errors when tracks fail to load or play" (Open, in progress)
- **Issue #185** : "Can't play music" (Closed)
- **Issue #182** : "Why does Lavalink not allow to turn on age-restricted content?" (Open)
- **Issue #161** : "Clean Refresh token and Oauth passed, but 'Sign in Required'" (Closed, Not planned)

### Issues liés à 401 (recherche "401")
- **Issue #188** : "Show all client errors when tracks fail to load or play" (Open, in progress)
  - Cette issue semble être la plus pertinente car elle mentionne l'affichage des erreurs client

## Problèmes OAuth 401 identifiés ailleurs

D'après la recherche web, les erreurs OAuth 401 sont souvent causées par :

1. **Encodage des caractères spéciaux** : Les credentials avec des caractères spéciaux (comme `/` dans le clientSecret) peuvent être mal encodés
   - Votre `clientSecret` contient `-` et pourrait avoir des problèmes d'encodage
   - Solution : Vérifier que le plugin n'encode pas incorrectement les credentials

2. **Type de client OAuth incorrect** : Le type de client OAuth dans Google Console doit correspondre
   - Vérifier que le client est de type "Web application" et non "Desktop" ou autre

3. **Configuration OAuth invalide** : Les identifiants peuvent être corrects mais la configuration dans Google Console peut être incorrecte

## Recommandations

### 1. Vérifier l'encodage des credentials

Votre `clientSecret` est : `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`

Le plugin pourrait avoir des problèmes avec les caractères spéciaux. Essayez de :
- Vérifier que le plugin n'encode pas incorrectement le clientSecret
- Regarder les logs DEBUG pour voir exactement quelle requête est envoyée

### 2. Vérifier le type de client OAuth

Dans Google Cloud Console :
1. Allez dans **APIs & Services** > **Credentials**
2. Vérifiez que votre OAuth 2.0 Client ID est de type **"Web application"**
3. Vérifiez que l'URI de redirection est correcte (même si elle n'est pas utilisée par Lavalink)

### 3. Créer une nouvelle issue GitHub

Si le problème persiste, créez une nouvelle issue sur :
https://github.com/lavalink-devs/youtube-source/issues

**Template suggéré** :
```
**Description**
Refresh token works with curl but Lavalink plugin gets 401 error during initialization.

**Steps to reproduce**
1. Configure OAuth in application.yml with valid credentials
2. Start Lavalink
3. Error: `java.io.IOException: Invalid status code for oauth2 token fetch: 401`

**Expected behavior**
Lavalink should start successfully with valid OAuth credentials.

**Actual behavior**
Lavalink fails to start with 401 error, even though the refresh token works with curl.

**Test results**
- curl test: ✅ Success (access_token generated)
- Lavalink: ❌ 401 error

**Environment**
- Lavalink version: 4.1.2
- YouTube-Source plugin: 1.16.0
- Java: 17.0.17
```

### 4. Vérifier les logs détaillés

Avec le logging DEBUG activé :
```yaml
logging:
  level:
    dev.lavalink.youtube: DEBUG
```

Les logs devraient montrer la requête exacte qui échoue.

## Issue #161 - Détails complets

**Titre** : "Clean Refresh token and Oauth passed, but 'Sign in Required' 1.13.3"
- **Statut** : Closed as not planned
- **Date** : 14 juin 2025
- **Version** : youtube-source 1.13.3

**Problème rapporté** :
- L'utilisateur avait un refresh token propre et OAuth configuré correctement
- Mais obtenait toujours l'erreur : `This video requires login`
- Même avec OAuth activé, certaines vidéos nécessitaient toujours une connexion

**Configuration client** :
```
- MUSIC - TVHTML5EMBEDDED - TV - MWEB - WEBEMBEDDED - ANDROID_VR - ANDROID - ANDROID_MUSIC
```

**Résolution** : L'issue a été fermée comme "Not planned", ce qui signifie que :
- Le problème n'a pas été résolu
- Il n'est pas considéré comme prioritaire par les mainteneurs
- C'est un problème connu mais sans solution officielle

## Comparaison avec votre problème

Votre situation est **similaire mais différente** :
- ✅ Issue #161 : OAuth configuré mais "Sign in Required" pour certaines vidéos
- ❌ Votre cas : OAuth empêche Lavalink de démarrer avec erreur 401

**Différence clé** : Dans votre cas, le refresh token fonctionne avec curl mais le plugin obtient 401 lors de l'initialisation, empêchant Lavalink de démarrer. Dans l'issue #161, Lavalink démarrait mais certaines vidéos nécessitaient toujours une connexion.

## Conclusion

Le problème que vous rencontrez (refresh token valide avec curl mais 401 avec Lavalink) semble être un problème connu mais non résolu dans le plugin. L'issue #161 était similaire mais a été fermée comme "Not planned".

**Actions recommandées** :
1. ✅ Vérifier l'encodage des credentials dans le plugin (votre clientSecret contient `-`)
2. ✅ Vérifier le type de client OAuth dans Google Console (doit être "Web application")
3. ✅ Créer une nouvelle issue GitHub avec tous les détails (voir template ci-dessous)
4. ✅ En attendant, utiliser le bot sans OAuth (fonctionne pour la plupart des vidéos publiques)

## Template pour créer une nouvelle issue GitHub

Si vous voulez créer une issue, voici un template :

```markdown
**Description**
Refresh token works with curl but Lavalink plugin gets 401 error during initialization, preventing Lavalink from starting.

**Steps to reproduce**
1. Configure OAuth in application.yml with valid credentials
2. Start Lavalink
3. Error: `java.io.IOException: Invalid status code for oauth2 token fetch: 401`

**Expected behavior**
Lavalink should start successfully with valid OAuth credentials.

**Actual behavior**
Lavalink fails to start with 401 error, even though the refresh token works with curl.

**Test results**
- curl test: ✅ Success (access_token generated)
- Lavalink: ❌ 401 error during initialization

**Environment**
- Lavalink version: 4.1.2
- YouTube-Source plugin: 1.16.0
- Java: 17.0.17

**Configuration**
```yaml
plugins:
  youtube:
    enabled: true
    oauth:
      enabled: true
      clientId: "651727633861-1to9tvl8f356d1bab1v54sgqtqkm1olv.apps.googleusercontent.com"
      clientSecret: "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"
      refreshToken: "1//03lAwfSJBHo2pCgYIARAAGAMSNwF-L9IrsGXfNlQLJuAynHcGXEZHcxhGKDPFQ2ElZiIZswR8UJMWHey__K7kSMxKL2vWleOTWbY"
```

**curl test (works)**
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=..." \
  -d "client_secret=..." \
  -d "refresh_token=..." \
  -d "grant_type=refresh_token"
```
Returns: `{"access_token": "...", "expires_in": 3599, ...}`
```

**Related issues**
- #161: Similar OAuth issue but different symptom (Lavalink starts but videos require login)
```

**Lien pour créer l'issue** : https://github.com/lavalink-devs/youtube-source/issues/new
