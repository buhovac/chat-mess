## Quoi
<!-- Une ou deux phrases : ce que cette PR ajoute ou change. Étape du roadmap concernée (ex. E3). -->

## Pourquoi
<!-- Le besoin / la user story / le critère du cours que ça couvre. -->

## Comment tester
<!-- Étapes concrètes, dans l'ordre, que le relecteur exécute (pas seulement lit). -->
1.
2.

## Captures
<!-- Au moins une. Copiez aussi le fichier dans docs/screenshots/eN-feature.png pour le rapport. -->

## Checklist
- [ ] `docker compose exec api npm test` passe
- [ ] Lint propre (api + client)
- [ ] Aucun secret, aucun `.env` dans le diff
- [ ] Toute nouvelle entrée utilisateur est validée côté serveur (zod)
- [ ] Toute nouvelle règle d'accès passe par `policies/authorize.js`
- [ ] Entrée ajoutée dans `docs/journal.md` si quelque chose a coincé
