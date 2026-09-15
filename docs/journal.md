# Journal des difficultés

Une entrée par problème réel, au moment où il arrive. Ce fichier alimente
directement le chapitre 7 du rapport (« Difficultés rencontrées & solutions »)
et les rapports d'avancement. Format : date, problème, solution, leçon.

## 2026-09-08 — Mise en place de l'environnement Docker (lockfiles manquants)
**Problème :** `npm ci` échouait (erreur EUSAGE) dans les images `api` et `client` au premier
`make up`. Cause : `server/package.json` et `client/package.json` avaient été écrits à la main
avec des plages de versions, mais aucun `package-lock.json` n'avait jamais été réellement généré.
**Solution :** génération des lockfiles sans installer `node_modules` sur l'hôte (`docker run
--rm -v "$PWD/<pkg>:/app" -w /app node:22-bookworm-slim npm install --package-lock-only`),
commit des deux `package-lock.json`.
**Leçon :** un `package.json` sans lockfile casse toujours `npm ci` — générer les lockfiles dès
le scaffold initial, pas après le premier échec de build.

## 2026-09-08 — Railway : variables ajoutées mais jamais déployées
**Problème :** après avoir ajouté `DATABASE_URL` et `JWT_SECRET` dans Railway, le service
continuait de crasher (`Environment variable not found: DATABASE_URL`, 502 sur le domaine
public).
**Solution :** Railway garde les changements de variables comme « staged » tant qu'on ne clique
pas sur **Deploy** — le service tournait encore sur l'ancien déploiement sans ces variables.
Clic sur Deploy → nouveau déploiement avec les bonnes variables → `/api/health` répond.
**Leçon :** un changement dans le dashboard Railway (variables, settings) ne redéploie jamais
automatiquement — toujours vérifier le bandeau « Apply changes » avant de chercher un bug côté
code.

## 2026-09-12 — `git reset --hard` a effacé des changements non commités
**Problème :** en essayant de déplacer un commit fait par erreur sur `main` vers une nouvelle
branche (`git checkout -b` puis `git checkout main` puis `git reset --hard origin/main`), le
schéma Prisma (`schema.prisma`) et `package.json` sont revenus à leur ancien contenu (placeholder
`HealthCheck`, dépendances manquantes) une fois revenu sur la branche de travail.
**Solution :** identifié que les fichiers *modifiés* (trackés) avaient été perdus par le `reset
--hard` — car un dépôt Git n'a qu'un seul répertoire de travail partagé entre les branches ; seuls
les fichiers *untracked* (migration, seed, docs) avaient survécu. Ré-écriture des deux fichiers
pour qu'ils correspondent à la migration déjà générée, re-commit, force-push.
**Leçon :** toujours commiter sur la nouvelle branche **avant** de toucher à `main`, ou utiliser
`git stash -u` (qui survit à un `reset --hard` sur n'importe quelle branche) plutôt que de laisser
des modifications non commitées pendant un changement de branche.

## 2026-09-12 — Test manquant repéré avant merge (E2 auth)
**Problème :** le brief pour l'authentification demandait explicitement un test « socket
connection without cookie is rejected », mais le premier passage de l'agent n'avait livré que les
5 tests REST (register/login/me), sans couverture du handshake Socket.IO.
**Solution :** repéré en comparant le rapport de l'agent au brief original avant d'approuver le
merge ; test ajouté (connexion sans cookie → rejetée ; avec cookie valide → connectée et room
`user:<id>` rejointe), 7/7 tests verts.
**Leçon :** ne jamais approuver un PR sur la seule foi du résumé de l'agent — comparer
explicitement la liste de tests livrée à celle demandée dans le brief.

## 2026-09-14 — Confusion de branches (feature/e3-conversations jamais créée)
**Problème :** l'étape `git checkout -b feature/e3-conversations` avait été oubliée avant de
lancer le travail suivant ; le commit de l'étape « conversations 1:1 » a atterri directement sur
`feature/e2-auth`. `git push -u origin feature/e3-conversations` a échoué (« src refspec does not
match any », branche inexistante).
**Solution :** plutôt que de découper le travail après coup (risque d'erreur supplémentaire sous
pression de temps), décision de consolider authentification + conversations dans un seul PR.
**Leçon :** sous contrainte de temps, un seul PR propre et bien testé vaut mieux que plusieurs
branches empilées mal synchronisées — la discipline « une branche par étape » peut céder devant
le risque réel de perdre du temps à la démêler.

## 2026-09-14 — Coéquipière indisponible, PR bloqué par la review obligatoire
**Problème :** Anyssa indisponible plusieurs jours (raison de santé) ; le PR #1 (schéma) est
resté sans review pendant 2+ jours, bloquant tout merge vers `main` alors que la Revue #1
approchait — la branch protection exige une approbation avant merge.
**Solution :** après une tentative de la contacter directement restée sans réponse, merge par
l'administrateur du repo (bypass documenté de la branch protection, option réservée aux
administrateurs). Le professeur a été informé proactivement de la situation avant la revue.
**Leçon :** dans une équipe de 2, prévoir un délai tampon avant chaque revue, et savoir qu'un
merge admin reste possible en dernier recours sans désactiver la protection définitivement.

## 2026-09-15 — Pagination cassée par un tri Postgres non déterministe
**Problème :** `orderBy: { createdAt: "desc" }` seul n'est pas un ordre total. Le script de seed
insère des dizaines de messages en boucle serrée ; plusieurs tombent sur le même timestamp
(précision milliseconde), et Postgres ne garantit aucun ordre entre égalités — le curseur de
pagination sautait ou dupliquait des messages à la frontière de page.
**Solution :** ajout d'une clé de tri secondaire (`id`) pour garantir un ordre total et stable,
détecté et corrigé pendant les tests manuels de l'étape « conversations ».
**Leçon :** un `orderBy` sur un seul champ non-unique n'est jamais fiable pour de la pagination —
toujours une clé secondaire unique (id, ou `createdAt` + `id`).

## 2026-09-15 — Déploiement en retard confondu avec un bug de code
**Problème :** après avoir mergé l'étape « messages temps réel », le composer (champ de saisie)
n'apparaissait pas sur une conversation vide en production — a été d'abord diagnostiqué comme un
bug potentiel côté `MessageList.jsx` (early return sautant le rendu du composer).
**Solution :** avant de faire corriger un bug inexistant, vérification des Deploy Logs Railway :
le déploiement actif correspondait encore au commit précédent (schéma+auth+conversations), le PR
du temps réel n'avait pas encore été mergé/déployé. Une fois mergé et le nouveau déploiement actif
confirmé, le composer fonctionnait normalement.
**Leçon :** toujours vérifier le commit/timestamp du déploiement actif avant de diagnostiquer un
bug depuis la production — un déploiement en retard se comporte exactement comme un bug de code.

## 2026-09-15 — Identité du socket périmée lors d'un changement d'utilisateur
**Problème :** trouvé pendant un test manuel avec deux comptes réels : `socket.connect()` ne fait
rien si un socket est déjà connecté. Se reconnecter en tant qu'utilisateur différent sans passer
par une déconnexion intermédiaire laissait l'identité du socket périmée côté serveur, attribuant
les nouveaux messages au mauvais expéditeur (mauvais nom affiché).
**Solution :** déconnexion explicite du socket avant reconnexion dans l'effet `AuthProvider` lié
au changement d'état d'authentification. Confirmé corrigé via un vrai flux à deux utilisateurs.
**Leçon :** toujours tester un changement d'utilisateur réel (pas seulement une première
connexion) dès qu'un état — ici le socket — est lié à l'identité de l'utilisateur.

## 2026-09-15 — ESLint jamais configuré depuis l'étape 0
**Problème :** `npm run lint` était référencé dans le template de PR et le brief de l'étape 0,
mais aucune config ESLint n'avait jamais été réellement créée ni pour `server/` ni pour
`client/` — repéré tardivement, en préparant le pipeline CI/CD requis avant la Revue #1.
**Solution :** ajout d'une config ESLint flat minimale (`eslint:recommended` + `react-hooks` côté
client) en même temps que le workflow GitHub Actions, dans l'urgence avant la revue.
**Leçon :** vérifier qu'un script mentionné dans un template (PR, CI) existe réellement dès qu'il
est ajouté au template — sinon il reste une promesse non tenue jusqu'à ce qu'un autre besoin le
révèle.
