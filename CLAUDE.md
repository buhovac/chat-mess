# chat-mess — instructions pour l'agent de code

Ce fichier est lu automatiquement par l'agent (Claude Code ou équivalent) à chaque
session de travail dans ce repo. Il remplace le besoin de recoller tout le contexte
à chaque fois. Le roadmap détaillé (briefs par étape, critères d'acceptation) vit
dans `docs/roadmap.md` — le lire avant de commencer une étape.

## Contexte

Projet scolaire (5IDEV, Ifosup) : application de messagerie B2B temps réel
(façon Slack), en équipe de 2 (Marko, Anyssa), notée sur le déploiement en
production, la qualité du code, un rapport et une soutenance orale. Marko doit
comprendre chaque ligne écrite — explique toujours le *pourquoi*, pas juste le *quoi*.

## État actuel (mettre à jour ✅ à chaque PR mergée dans `main`)

- [x] Docker Compose local (db, adminer, api, client) — fonctionne sur Mac et
      Windows/WSL2. Règle d'or : jamais de `npm install` sur l'hôte, toujours
      `docker compose exec api|client npm install <pkg>`.
- [x] `Dockerfile` racine (image production, multi-stage) — build OK.
- [x] Déployé sur Railway (Hobby plan), Postgres plugin dans le même projet,
      auto-deploy sur chaque push vers `main`. `/api/health` répond en prod.
- [ ] Schéma Prisma réel (`User`, `Conversation`, `ConversationMember`, `Message`)
      — actuellement seulement un modèle placeholder `HealthCheck`.
- [ ] Authentification (JWT dans un cookie httpOnly).
- [ ] Conversations 1:1 + historique paginé (REST).
- [ ] Messages en temps réel (Socket.IO).
- [ ] GitHub Actions CI (lint + test + build sur chaque PR) — pas encore branché ;
      pas bloquant pour l'instant, à faire dès que le rythme le permet.

## Stack fixe — ne jamais proposer d'alternative sans demander

Node.js 22 (ESM), Express 4, Socket.IO 4, Prisma 6 + PostgreSQL 16, React 18 +
Vite 5, CSS simple (pas de UI kit sans validation explicite). Un seul
Dockerfile de production : Express sert l'API + le WebSocket + le build React
sur un seul port. Hébergement : Railway.

## Structure du repo

```
server/
  src/config/          env.js (validation zod des variables au boot)
  src/lib/              prisma.js, jwt.js, password.js
  src/middleware/       requireAuth.js, etc.
  src/modules/<feature>/  router.js, service.js, schema.js (zod)
  src/policies/authorize.js   ← LA seule source de vérité pour les permissions
  src/sockets/
  prisma/schema.prisma, prisma/migrations/, prisma/seed.js
client/
  src/app, src/features/<feature>, src/components, src/pages
  src/lib/api.js (fetch wrapper), src/lib/socket.js (singleton io())
docs/
  roadmap.md, journal.md, data-model.md, testing.md, demo-script.md
```

## Règles que l'agent n'a pas le droit d'enfreindre

- Ne jamais toucher `.env`, ne jamais hardcoder de secret, ne jamais commiter de clé.
- Toute vérification de droit d'accès passe par `src/policies/authorize.js`
  (fonctions pures, testées unitairement) — jamais de `if` inline dans un contrôleur.
- Toute entrée utilisateur est validée côté serveur avec **zod**, même si le
  frontend valide déjà.
- Ne jamais modifier une migration Prisma déjà appliquée — toujours en créer une nouvelle.
- Ne jamais ajouter de nouveau service d'infra (Redis, S3, queue, etc.) sans OK explicite.
- Écrire les tests que l'étape demande, pas "plus tard".
- Erreurs renvoyées au client au format `{ error: { code, message } }`, jamais de stack trace.

## Conventions

- Tests : Vitest (+ supertest côté serveur). Fichiers `*.test.js` à côté du code
  testé. Doivent tourner via `npm test` dans le conteneur `api`, contre le
  Postgres de Compose (`DATABASE_URL` déjà configurée).
- Socket.IO : les handlers réutilisent les mêmes services et policies que le
  REST. Rooms : `user:<id>` et `conversation:<id>`.
- Commits petits et relisibles, préfixés `feat:`, `fix:`, `test:`, `chore:`.
- Commentaires expliquent le *pourquoi*, brièvement. Pas de code mort, pas de TODO oublié.
- Une branche par étape ou sous-étape : `feature/eN-nom`. PR obligatoire vers
  `main` (branch protection déjà active), review par l'autre membre.

## Comment travailler avec moi (boucle obligatoire, à chaque étape)

1. Réponds d'abord avec un **plan court + liste des fichiers** que tu vas
   créer/modifier + tes questions éventuelles. Attends mon accord avant de coder.
2. Implémente ensuite.
3. Explique **exactement** comment tester manuellement, et ce que `npm test`
   doit afficher.
4. Si le brief contredit le code existant ou une décision déjà prise ici,
   arrête-toi et demande — n'improvise pas une solution différente.

## Roadmap complet

`docs/roadmap.md` contient les 10 étapes du projet avec, pour chacune : ce
qu'elle livre, pourquoi, le brief exact à donner à l'agent, les critères
d'acceptation (vérifiés manuellement par Marko), et ce qu'il doit comprendre
pour pouvoir le défendre à l'oral. Le lire avant toute nouvelle étape.
