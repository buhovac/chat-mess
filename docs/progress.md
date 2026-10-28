# Suivi — ce qui reste à faire

Liste courte des suites volontairement repoussées, pour qu'elles ne se
perdent pas. Le détail de ce qui a été fait reste dans `docs/journal.md`.

## Étape E6a (landing + passe mobile/accessibilité) — repoussé

- **Page `/pricing` complète.** En attendant, le lien « Tarifs » du pied de
  page de la landing pointe vers `/register` (un seul `TODO` dans
  `client/src/pages/Landing.jsx`, à retirer quand la page existe).
- **Vidéo/gif de démo.** Le `<figure>` de la landing contient une capture
  d'écran statique (`client/public/landing-app.jpg`) ; il suffit de remplacer
  le `<img>` par un `<video>`. La capture actuelle montre des messages de
  test : à refaire avec une conversation de groupe plus présentable.
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
