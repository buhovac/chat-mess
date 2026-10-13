import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.jsx";

// Single place to rename the product: every mention below reads this.
const BRAND = "Relai";
const REPO_URL = "https://github.com/buhovac/chat-mess";

// Only features that are actually shipped — nothing aspirational here.
const BENEFITS = [
  {
    title: "Temps réel, sans rafraîchir",
    text: "Messages, présence et indicateur de frappe arrivent instantanément via WebSocket.",
  },
  {
    title: "Des permissions qui tiennent",
    text: "Propriétaire, admin, membre : chaque action est vérifiée côté serveur, pas seulement cachée dans un bouton.",
  },
  {
    title: "La sécurité prise au sérieux",
    text: "Cookies httpOnly, et un changement de mot de passe invalide immédiatement toutes les autres sessions ouvertes.",
  },
];

const STEPS = ["Créez votre compte", "Invitez votre équipe, créez vos groupes", "Discutez en temps réel, partout"];

export default function Landing() {
  // `user` stays null while /api/auth/me is loading, so a logged-in visitor
  // briefly sees the public CTA — acceptable, and it avoids a blank page.
  const { user } = useAuth();

  return (
    <div className="landing">
      <header className="landing-header">
        <span className="landing-brand">{BRAND}</span>
        <nav aria-label="Navigation principale">
          {user ? (
            <Link className="landing-nav-link" to="/app">
              Ouvrir l'app
            </Link>
          ) : (
            <Link className="landing-nav-link" to="/login">
              Se connecter
            </Link>
          )}
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <p className="landing-eyebrow">Messagerie d'équipe B2B</p>
          <h1>{BRAND} — la messagerie d'équipe qui dit vraiment qui peut quoi.</h1>
          <p className="landing-subhead">
            Conversations et groupes en temps réel, permissions appliquées jusqu'au bout — pas juste cachées dans
            l'interface — et une sécurité qui invalide vraiment vos sessions quand vous changez de mot de passe.
          </p>
          <div className="landing-cta-row">
            {user ? (
              <Link className="landing-cta" to="/app">
                Ouvrir l'app
              </Link>
            ) : (
              <>
                <Link className="landing-cta" to="/register">
                  Essayer gratuitement
                </Link>
                <Link className="landing-secondary-link" to="/login">
                  Déjà un compte ? Se connecter
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="landing-benefits-title">
          {/* Hidden visually: the cards speak for themselves, but screen
              readers need an h2 between the h1 and the cards' h3. */}
          <h2 id="landing-benefits-title" className="visually-hidden">
            Les points forts
          </h2>
          <ul className="landing-cards">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="landing-card">
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="landing-steps-title">
          <h2 id="landing-steps-title">Comment ça marche</h2>
          <ol className="landing-steps">
            {STEPS.map((step, index) => (
              <li key={step} className="landing-step">
                {/* The <ol> already announces the position; the big digit is decoration. */}
                <span className="landing-step-number" aria-hidden="true">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="landing-media-title">
          <h2 id="landing-media-title">L'application en image</h2>
          {/* Media slot: swap the <img> for a <video> later, the <figure>
              and its caption stay as they are. */}
          <figure className="landing-media">
            <img
              src="/landing-app.jpg"
              alt={`Capture d'écran de ${BRAND} : la liste des conversations à gauche et une discussion ouverte à droite, avec le champ de saisie en bas.`}
              width="1270"
              height="952"
              loading="lazy"
            />
            <figcaption>Une conversation dans {BRAND}.</figcaption>
          </figure>
        </section>
      </main>

      <footer className="landing-footer">
        <p>{BRAND} — la messagerie d'équipe en temps réel.</p>
        <nav aria-label="Liens de pied de page">
          {/* TODO: point to /pricing once that page exists (see docs/progress.md). */}
          <Link to="/register">Tarifs</Link>
          <a href={REPO_URL}>Code source sur GitHub</a>
        </nav>
      </footer>
    </div>
  );
}
