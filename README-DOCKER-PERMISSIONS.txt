═══════════════════════════════════════════════════════════════
  GUIDE RAPIDE : Utiliser Docker sans sudo
═══════════════════════════════════════════════════════════════

✅ Vous avez été ajouté au groupe docker !

⚠️  IMPORTANT : Les changements de groupe nécessitent une nouvelle session.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SOLUTION IMMÉDIATE (pour cette session)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Exécutez cette commande pour activer le groupe docker :

    newgrp docker

Ensuite, vous pouvez utiliser Docker sans sudo :

    docker ps
    docker compose ps
    ./start-docker.sh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SOLUTION PERMANENTE (recommandée)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Déconnectez-vous de votre session SSH
2. Reconnectez-vous
3. Maintenant Docker fonctionne sans sudo automatiquement !

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UTILISATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Le script start-docker.sh gère automatiquement les permissions :
- Il détecte si vous avez accès à Docker
- Si non, il utilise sudo temporairement
- Après reconnexion, tout fonctionne sans sudo

Commandes disponibles (après reconnexion ou newgrp docker) :

    ./start-docker.sh          # Démarrer le bot
    docker compose ps           # Voir les conteneurs
    docker compose logs -f       # Voir les logs
    docker compose restart      # Redémarrer
    docker compose down         # Arrêter

Ou utilisez les alias (déjà configurés dans ~/.bashrc) :

    dc ps                       # docker compose ps
    dcu                         # docker compose up -d
    dcd                         # docker compose down
    dcr                         # docker compose restart
    dcl                         # docker compose logs -f

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VÉRIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vérifier si vous êtes dans le groupe docker :
    groups | grep docker

Tester l'accès Docker :
    docker ps

Si ça fonctionne sans sudo → ✅ Tout est OK !
Si ça demande sudo → Exécutez: newgrp docker

═══════════════════════════════════════════════════════════════
