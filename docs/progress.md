# Suivi — ce qui reste à faire

Liste courte des suites volontairement repoussées, pour qu'elles ne se
perdent pas. Le détail de ce qui a été fait reste dans `docs/journal.md`.

## Étape E6a (landing + passe mobile/accessibilité) — repoussé

- **Section / page tarifs.** Volontairement absente de la refonte E6c :
  PRO n'a aujourd'hui qu'un badge (bascule « démo »), donc des cartes
  FREE/PRO affirmeraient des choses fausses. En attendant, le lien
  « Tarifs » du pied de page pointe vers `/register` (un seul `TODO` dans
  `client/src/pages/Landing.jsx`, à retirer quand la page existe).
- **Réglages Lighthouse** (performance, SEO, accessibilité chiffrée).
- **Tests d'accessibilité automatisés** (ex. jest-axe) — nouvelle dépendance,
  à valider avant de l'ajouter.
- **Clavier virtuel sur iOS Safari.** Le compositeur reste visible grâce à
  `100dvh` + `interactive-widget=resizes-content` (Chrome Android). Safari
  ignore cette option et fait simplement défiler le champ dans la vue : à
  vérifier sur un vrai iPhone.
- **Feuille « Membres » sur mobile.** Pas de piège à focus ni de fermeture
  avec Échap pour l'instant (le bouton « Fermer » et le fond cliquable
  suffisent pour la démo).

## Étape E-attach (pièces jointes images + PDF) — repoussé

Version minimale livrée : une pièce jointe par message, 5 Mo max, PNG/JPEG/
WEBP/GIF/PDF, bucket R2 privé servi via `GET /api/attachments/:messageId`.

- **Plusieurs pièces jointes par message** (demanderait une table
  `Attachment` séparée à la place des 4 colonnes sur `Message`).
- **Miniatures / redimensionnement des images** — aujourd'hui l'image
  d'origine (jusqu'à 5 Mo) est chargée telle quelle.
- **Glisser-déposer** dans le compositeur.
- **Texte + fichier dans le même message** — pour l'instant un fichier part
  seul, le texte s'envoie à côté.
- **Quota réservé au plan Pro** (taille max ou volume total).
- **Supprimer / remplacer une pièce jointe** après envoi.
- **Recherche dans les pièces jointes.**
- **Nettoyage R2** : supprimer une conversation ou un compte efface les
  lignes `Message` (cascade) mais laisse les objets dans le bucket. À faire
  avec une suppression par préfixe `conversations/<id>/`.
- **Défilement** : une image qui finit de charger après l'ouverture de la
  conversation peut repousser le dernier message un peu sous le bord.

## Étape E6c (refonte visuelle de la landing) — repoussé

- **Image Open Graph** (`og:image`, 1200×630) : la capture d'écran a été
  retirée avec la refonte, il n'y a donc pas d'image d'aperçu quand le lien
  est partagé. Une image fixe aux couleurs du deck suffirait.
