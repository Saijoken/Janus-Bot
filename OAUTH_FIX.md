# Correction du problème OAuth "Access Denied"

## Problème
L'erreur indique que votre application OAuth est en mode "test" et que votre compte n'est pas autorisé.

## Solution : Ajouter votre compte comme Test User

### Étape 1 : Configurer l'écran de consentement OAuth

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. Allez dans **APIs & Services** > **OAuth consent screen**
4. Si ce n'est pas déjà fait, configurez l'écran de consentement :
   - **User Type** : Choisissez **External** (ou Internal si vous avez Google Workspace)
   - Cliquez sur **Create**
   - Remplissez les informations requises :
     - **App name** : Nom de votre application (ex: "Discord Music Bot")
     - **User support email** : Votre email
     - **Developer contact information** : Votre email
   - Cliquez sur **Save and Continue**

### Étape 2 : Ajouter des Scopes

1. Dans la section **Scopes**, cliquez sur **Add or Remove Scopes**
2. Ajoutez le scope : `https://www.googleapis.com/auth/youtube.readonly`
3. Cliquez sur **Update** puis **Save and Continue**

### Étape 3 : Ajouter des Test Users (IMPORTANT)

1. Dans la section **Test users**, cliquez sur **Add Users**
2. Ajoutez votre adresse email Google (celle que vous utilisez pour vous connecter)
3. Cliquez sur **Add**
4. Cliquez sur **Save and Continue**

### Étape 4 : Publier l'application (Optionnel mais recommandé)

Si vous voulez que l'application soit accessible sans limite de test users :
1. Allez dans **OAuth consent screen**
2. Cliquez sur **Publish App**
3. Confirmez la publication

⚠️ **Note** : Pour une application en production, Google peut demander une vérification si vous utilisez des scopes sensibles.

## Après avoir ajouté votre compte comme Test User

1. Attendez quelques minutes (parfois il faut attendre que les changements se propagent)
2. Réessayez l'URL d'autorisation
3. Vous devriez maintenant pouvoir autoriser l'application
4. Après autorisation, vous serez redirigé vers `http://localhost:8080/oauth2callback?code=...`
5. Copiez le code qui se trouve après `code=` dans l'URL

## Alternative : Utiliser un compte Google différent

Si vous avez un autre compte Google, vous pouvez :
1. L'ajouter comme Test User dans Google Cloud Console
2. Utiliser ce compte pour l'autorisation OAuth
