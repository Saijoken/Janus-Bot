#!/usr/bin/env python3
"""
Script pour obtenir un refresh token OAuth pour YouTube-Source Plugin
"""
import json
from urllib.parse import urlencode
import urllib.request

print("=" * 60)
print("Générateur de Refresh Token OAuth pour YouTube-Source")
print("=" * 60)
print()

# Demander les identifiants
CLIENT_ID = input("Entrez votre Client ID : ").strip()
CLIENT_SECRET = input("Entrez votre Client Secret : ").strip()

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
print("\n" + "=" * 60)
print("ÉTAPE 1 : Autorisation")
print("=" * 60)
print(f"\n1. Ouvrez cette URL dans votre navigateur :\n\n{auth_full_url}\n")
print("2. Connectez-vous avec votre compte Google")
print("3. Autorisez l'application")
print("   ⚠️  Si vous voyez 'Access Denied', ajoutez votre compte comme")
print("   'Test User' dans Google Cloud Console > OAuth consent screen")
print("4. Après autorisation, vous serez redirigé vers une URL comme :")
print("   http://localhost:8080/oauth2callback?code=XXXXX")
print("5. Copiez le code d'autorisation depuis l'URL de redirection")
print("   (il se trouve après 'code=' dans l'URL)\n")
print("=" * 60)

auth_code = input("\nCollez le code d'autorisation ici : ").strip()

# Étape 2 : Échanger le code contre un refresh token
print("\n" + "=" * 60)
print("ÉTAPE 2 : Obtention du Refresh Token")
print("=" * 60)
print("\nÉchange du code d'autorisation contre un refresh token...\n")

token_url = "https://oauth2.googleapis.com/token"
data = {
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "code": auth_code,
    "grant_type": "authorization_code",
    "redirect_uri": "http://localhost:8080/oauth2callback"
}

try:
    req = urllib.request.Request(token_url, data=urlencode(data).encode())
    response = urllib.request.urlopen(req)
    token_data = json.loads(response.read().decode())
    
    refresh_token = token_data.get('refresh_token')
    
    if refresh_token:
        print("=" * 60)
        print("✅ SUCCÈS ! Refresh Token obtenu")
        print("=" * 60)
        print(f"\nRefresh Token :\n{refresh_token}\n")
        print("=" * 60)
        print("\n⚠️  IMPORTANT :")
        print("1. Gardez ce token en sécurité")
        print("2. Ajoutez-le dans lavalink/application.yml")
        print("3. Ne le partagez jamais publiquement")
        print("=" * 60)
        
        # Afficher la configuration à ajouter
        print("\n📝 Configuration à ajouter dans lavalink/application.yml :\n")
        print("plugins:")
        print("  youtube:")
        print("    enabled: true")
        print("    allowSearch: true")
        print("    allowDirectVideoIds: true")
        print("    allowPlaylists: true")
        print("    allowChannels: true")
        print("    oauth:")
        print("      enabled: true")
        print(f'      clientId: "{CLIENT_ID}"')
        print(f'      clientSecret: "{CLIENT_SECRET}"')
        print(f'      refreshToken: "{refresh_token}"')
        print()
    else:
        print("❌ Erreur : Aucun refresh token dans la réponse")
        print("Réponse complète :", json.dumps(token_data, indent=2))
        
except urllib.error.HTTPError as e:
    error_body = e.read().decode()
    print(f"❌ Erreur HTTP {e.code}: {error_body}")
    try:
        error_data = json.loads(error_body)
        print(f"\nDétails : {error_data.get('error_description', 'Aucun détail')}")
    except:
        pass
except Exception as e:
    print(f"❌ Erreur : {e}")
