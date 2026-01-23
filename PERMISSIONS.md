# Guide des Permissions Utilisateur

## Pourquoi ne pas utiliser root en permanence ?

**⚠️ IMPORTANT : Ne jamais utiliser root en permanence !**

1. **Sécurité** : Root peut tout faire, y compris supprimer des fichiers système critiques
2. **Erreurs** : Une erreur avec root peut détruire tout le système
3. **Traçabilité** : Les actions avec sudo sont tracées, root non
4. **Bonnes pratiques** : Utiliser sudo uniquement quand nécessaire est la norme

## Solutions pour éviter sudo

### 1. Docker (✅ Déjà configuré)

Vous avez été ajouté au groupe `docker`. Pour appliquer les changements :

**⚠️ IMPORTANT : Les changements de groupe ne prennent effet qu'après une nouvelle session !**

**Solution immédiate (session actuelle) :**
```bash
# Activer le groupe docker pour cette session
newgrp docker

# Maintenant vous pouvez utiliser Docker sans sudo
docker ps
```

**Solution permanente (recommandée) :**
```bash
# Se déconnecter de votre session SSH et reconnecter
# Ou fermer votre terminal et le rouvrir
```

**Le script `start-docker.sh` gère automatiquement les permissions !**
- Si vous n'êtes pas dans le groupe docker, il vous y ajoute
- Si vous êtes dans le groupe mais la session n'est pas à jour, il utilise sudo temporairement
- Après reconnexion, tout fonctionnera sans sudo

**Test :**
```bash
# Après newgrp docker ou reconnexion
docker ps  # Devrait fonctionner sans sudo
```

### 2. Créer des alias pour simplifier

Ajoutez ces alias dans votre `~/.bashrc` :

```bash
# Éditer le fichier
nano ~/.bashrc

# Ajouter à la fin :
alias d='docker'
alias dc='docker compose'
alias dcu='docker compose up -d'
alias dcd='docker compose down'
alias dcr='docker compose restart'
alias dcl='docker compose logs -f'
alias dcb='docker compose build'

# Recharger
source ~/.bashrc
```

Maintenant vous pouvez utiliser :
- `dc ps` au lieu de `sudo docker compose ps`
- `dcu` au lieu de `sudo docker compose up -d`
- etc.

### 3. Permissions spécifiques pour des dossiers

Si vous avez besoin d'écrire dans un dossier spécifique :

```bash
# Donner la propriété d'un dossier à votre utilisateur
sudo chown -R $USER:$USER /chemin/vers/dossier

# Ou donner les permissions d'écriture au groupe
sudo chmod -R g+w /chemin/vers/dossier
sudo chgrp -R $USER /chemin/vers/dossier
```

### 4. Scripts avec sudo intégré

Créez des scripts qui utilisent sudo automatiquement :

```bash
#!/bin/bash
# script.sh
sudo commande-qui-necessite-sudo
```

Puis rendez-le exécutable :
```bash
chmod +x script.sh
./script.sh  # sudo est géré dans le script
```

## Commandes utiles

### Vérifier vos groupes
```bash
groups
id
```

### Voir les permissions d'un fichier
```bash
ls -la /chemin/vers/fichier
```

### Ajouter un utilisateur à un groupe
```bash
sudo usermod -aG nom_du_groupe $USER
# Puis se déconnecter/reconnecter
```

## Groupes courants

- **sudo** : Permet d'utiliser sudo (vous l'avez déjà)
- **docker** : Permet d'utiliser Docker sans sudo (maintenant configuré)
- **adm** : Accès aux logs système
- **www-data** : Pour les serveurs web (si nécessaire)

## ⚠️ Attention

**NE JAMAIS :**
- Utiliser `sudo su` ou `sudo -i` en permanence
- Donner des permissions 777 (rwxrwxrwx) à tous
- Exécuter des scripts inconnus avec sudo
- Modifier des fichiers système sans savoir ce que vous faites

## Résumé

✅ **Vous avez maintenant :**
- Accès sudo (pour les commandes administratives)
- Accès Docker sans sudo (après reconnexion)
- Scripts pratiques pour gérer les permissions

💡 **Pour Docker, reconnectez-vous ou utilisez `newgrp docker`**
