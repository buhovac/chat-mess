import { prisma } from "../../lib/prisma.js";

const MAX_RESULTS = 20;

// Pas de garde "query vide -> []" ici : le dialog "Nouvelle conversation" doit
// afficher la liste des collègues dès l'ouverture (demande du prof après la
// démo), donc une query vide liste tout le monde (sauf soi-même). Ce n'est pas
// un oubli de sécurité : la route est déjà derrière requireAuth, et MAX_RESULTS
// borne la réponse comme pour une recherche normale (un scraper authentifié
// pourrait de toute façon itérer q=a..z pour obtenir la même liste).
export async function searchUsers({ query, excludeUserId }) {
  return prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      ...(query
        ? {
            OR: [
              { displayName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
    take: MAX_RESULTS,
  });
}
