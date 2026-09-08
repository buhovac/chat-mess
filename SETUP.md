# Environnement de dev — setup Mac + Windows

Idée générale : **personne n'installe Node, npm, ou Postgres sur sa machine.**
Tout tourne dans des conteneurs Docker identiques (même image Linux, même
version de Node, même Postgres) sur les deux laptops. Le seul logiciel
"natif" à installer est Docker Desktop lui-même. C'est ce qui évite le
classique "ça marche chez moi" entre un Mac et un Windows.

## 1. Prérequis — une fois, par personne

### macOS
1. Installer [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) (choisir la version **Apple Silicon** si le Mac a une puce M-series, Intel sinon).
2. Lancer Docker Desktop, attendre l'icône baleine stable dans la barre de menu.

### Windows
1. Installer WSL2 : ouvrir PowerShell **en administrateur** et lancer :
   ```powershell
   wsl --install
   ```
   Redémarrer si demandé. Ça installe Ubuntu par défaut.
2. Installer [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/), et pendant l'installation cocher **"Use WSL 2 instead of Hyper-V"** (coché par défaut sur les versions récentes).
3. Dans Docker Desktop → Settings → Resources → WSL Integration, vérifier que l'intégration avec la distro Ubuntu est activée.
4. **Ouvrir un terminal Ubuntu (WSL2)** — pas PowerShell, pas cmd — pour toutes les commandes qui suivent (`git`, `docker`, `make`). C'est important : ça donne un vrai shell bash, identique à celui du Mac, et évite les problèmes de fins de ligne et de chemins Windows.

### Les deux plateformes
- Un compte GitHub avec accès au repo.
- PHPStorm (voir §4 pour le brancher sur les conteneurs).

## 2. Cloner le repo

**Important côté Windows :** cloner **à l'intérieur** du système de fichiers WSL2, jamais sous `/mnt/c/...`. Le montage `/mnt/c` traverse la frontière Windows↔Linux et rend le file-watching (hot reload) lent et parfois cassé.

```bash
# dans le terminal Ubuntu (Windows) ou Terminal (Mac)
cd ~
mkdir -p projects && cd projects
git clone https://github.com/buhovac/chat-mess.git
cd chat-mess
```

## 3. Premier démarrage

```bash
cp .env.example .env
# éditer .env si besoin (les valeurs par défaut suffisent pour du dev local)

make up
# équivalent sans make : docker compose up --build
```

Ça construit les images api et client, télécharge Postgres et Adminer, et démarre tout. Premier lancement : compter 2-3 minutes (téléchargement des images de base + `npm ci` dans les conteneurs). Au démarrage, le conteneur `api` exécute automatiquement `prisma generate` puis `prisma migrate deploy` : la base locale reçoit le schéma sans rien faire à la main — c'est aussi ce qui se passera chez la personne qui vient de faire `git pull`.

Une fois que les logs se calment :
- Client : http://localhost:5173 — doit afficher "API + DB OK" et un aller-retour WebSocket.
- API : http://localhost:3001/api/health
- Adminer (interface base de données) : http://localhost:8080 (système `PostgreSQL`, serveur `db`, utilisateur/mot de passe/base : voir `.env`).

Si la page client affiche une erreur de connexion à l'API, vérifier que le conteneur `api` est bien "healthy" avec `docker compose ps`.

### Appliquer les migrations Prisma

```bash
make migrate
# équivalent : docker compose exec api npm run prisma:migrate
```

## 4. Brancher PHPStorm sur les conteneurs

Le code est édité normalement sur le disque (via le bind mount), donc l'édition de fichiers marche déjà sans rien configurer. Ce qui manque par défaut, c'est l'autocomplétion/lint côté JS — parce que `node_modules` vit **dans les conteneurs**, pas sur votre disque (volontairement, voir §5).

1. `Settings → Languages & Frameworks → Node.js` → interpréteur = **"Add Docker Compose..."**, pointer sur `docker-compose.yml`, service `api` (répéter pour `client` si besoin d'un second interpréteur).
2. `Settings → Languages & Frameworks → JavaScript` → Node interpreter = celui que vous venez d'ajouter. PHPStorm relit alors les paquets installés dans le conteneur pour l'autocomplétion.
3. (Optionnel mais confortable) `Settings → Build, Execution, Deployment → Docker` → ajouter la connexion Docker locale, pour voir logs/conteneurs directement dans l'IDE.

Sous Windows : ouvrir le projet directement depuis son chemin WSL2 (`\\wsl$\Ubuntu\home\<user>\projects\chat-mess` ou via le sélecteur "WSL" dans la boîte de dialogue d'ouverture de projet) — pas depuis un chemin `C:\`.

## 5. Règle d'or : jamais de `npm install` en dehors des conteneurs

Ajouter un paquet ne se fait jamais avec un `npm install` lancé sur le Mac ou sous Windows directement — ça régénère `node_modules` avec des binaires natifs propres à VOTRE OS, différents de ceux du conteneur Linux, et ça peut aussi faire diverger `package-lock.json` entre vos deux machines.

Toujours passer par le conteneur :

```bash
docker compose exec api npm install <paquet>
docker compose exec client npm install <paquet>
```

Puis commiter le `package.json` / `package-lock.json` modifié normalement. L'autre personne récupère juste avec `git pull` + `make up` (docker compose réinstalle automatiquement au prochain build si le lockfile a changé).

## 6. Commandes utiles

| Commande | Effet |
|---|---|
| `make up` | démarre tout, rebuild si les Dockerfiles/deps ont changé |
| `make down` | arrête tout |
| `make logs` | suit les logs api + client |
| `make shell-api` | ouvre un shell dans le conteneur api |
| `make migrate` | applique les migrations Prisma |
| `make reset` | ⚠️ supprime la base locale et repart de zéro |

## 7. Dépannage rapide

- **Hot reload ne se déclenche pas** (surtout observé sous Windows) : déjà couvert par `USE_POLLING` dans `vite.config.js`, activé par défaut. Si le problème persiste côté serveur (`nodemon`), vérifier que le repo est bien cloné dans le système de fichiers WSL2 et non sous `/mnt/c`.
- **Fins de ligne qui changent tout un fichier dans le diff Git** : `.gitattributes` force le LF partout ; si un fichier a été committé avant son ajout, `git add --renormalize .` une fois pour le remettre d'aplomb.
- **Le conteneur `api` boucle en erreur au démarrage** : `docker compose logs api` — la cause la plus fréquente est que Postgres n'est pas encore prêt ; le `depends_on: condition: service_healthy` dans `docker-compose.yml` est censé gérer ça, mais un `docker compose restart api` isolé suffit si besoin.
- **Ports déjà utilisés (3001/5173/5432/8080)** : un service local (ex. un Postgres déjà installé sur la machine) occupe le port — soit l'arrêter, soit changer le port exposé côté gauche dans `docker-compose.yml` (ex. `"5433:5432"`).

## 8. Lien avec la production (Railway)

`Dockerfile` à la racine du dépôt est l'image de PRODUCTION : elle compile le
client React et sert tout depuis un seul process Express — c'est ce fichier
que Railway construit au déploiement. Les `Dockerfile.dev` ne servent qu'en
local, pour le hot reload ; ne pas les confondre.
