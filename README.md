# chat-mess — Messagerie temps réel (B2B)

Projet 1 du cours *Projet d'intégration de développement* (5IDEV, Ifosup, 2026-2027).
Application de messagerie d'équipe en temps réel : conversations 1:1 et de groupe,
notifications, permissions — déployée en continu.

**Équipe :** Marko Buhovac · Anyssa Ouahib

## Stack
Node.js 22 · Express 4 · Socket.IO 4 · Prisma 6 + PostgreSQL 16 · React 18 + Vite 5 · Railway

## Démarrer en local
Tout tourne dans Docker — rien d'autre à installer que Docker Desktop.
Voir **[SETUP.md](SETUP.md)** pour le pas-à-pas (Mac et Windows).

```bash
cp .env.example .env
make up            # ou : docker compose up --build
```

- http://localhost:5173 — application (Vite, hot reload)
- http://localhost:3001/api/health — API
- http://localhost:8080 — Adminer (base de données)

## Organisation du dépôt
```
client/   React + Vite (frontend)
server/   Express + Socket.IO + Prisma (API, temps réel, base)
docs/     journal des difficultés, captures, notes pour le rapport
Dockerfile          image de PRODUCTION (Railway) — client buildé + API dans un seul process
docker-compose.yml  environnement de DEV (db, adminer, api, client)
```

## Processus
GitHub Flow : branche `feature/*` → Pull Request (relecture par l'autre membre) → merge dans `main` = production.
Un incrément déployé par semaine ; au moins une PR substantielle par personne et par semaine.

## Déploiement
`main` est construit par Railway à partir du `Dockerfile` racine. Variables requises côté Railway :
`DATABASE_URL` (fournie par le plugin Postgres), `JWT_SECRET`, `NODE_ENV=production`.
Aucun secret n'est versionné.
