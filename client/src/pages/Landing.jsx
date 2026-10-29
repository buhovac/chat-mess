import { useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.jsx";
import { FakeChat } from "../features/landing/FakeChat.jsx";
import { useReveal } from "../features/landing/useReveal.js";
import "./Landing.css";

// Single place to rename the product: every mention below reads this.
const BRAND = "ChatMess";
// Same line as on the pitch deck — keep the two in sync.
const BRAND_LINE = "Le nom est ironique. L'app, non.";
const REPO_URL = "https://github.com/buhovac/chat-mess";

// Only features that are actually shipped — nothing aspirational here.
// `accent` picks the card's icon circle + hover glow color (Landing.css).
const BENEFITS = [
  {
    title: "Temps réel, sans rafraîchir",
    text: "Messages, présence et indicateur de frappe arrivent instantanément via WebSocket.",
    accent: "coral",
    icon: IconBolt,
  },
  {
    title: "Des permissions qui tiennent",
    text: "Propriétaire, admin, membre : chaque action est vérifiée côté serveur, pas seulement cachée dans un bouton.",
    accent: "purple",
    icon: IconShield,
  },
  {
    title: "La sécurité prise au sérieux",
    text: "Cookies httpOnly, et un changement de mot de passe invalide immédiatement toutes les autres sessions ouvertes.",
    accent: "teal",
    icon: IconLock,
  },
];

const STEPS = ["Créez votre compte", "Invitez votre équipe, créez vos groupes", "Discutez en temps réel, partout"];

export default function Landing() {
  // `user` stays null while /api/auth/me is loading, so a logged-in visitor
  // briefly sees the public CTA — acceptable, and it avoids a blank page.
  const { user } = useAuth();
  const rootRef = useRef(null);
  useReveal(rootRef);

  const primaryCta = user ? (
    <Link className="landing-cta" to="/app">
      Ouvrir l'app
    </Link>
  ) : (
    <Link className="landing-cta" to="/register">
      Essayer gratuitement
    </Link>
  );

  return (
    <div className="landing" ref={rootRef}>
      <header className="landing-nav">
        <div className="landing-container landing-nav-inner">
          <a className="landing-logo" href="#top">
            <LogoMark />
            {BRAND}
          </a>
          <nav className="landing-nav-links" aria-label="Navigation principale">
            <a className="landing-nav-anchor" href="#fonctionnalites">
              Fonctionnalités
            </a>
            <a className="landing-nav-anchor" href="#comment-ca-marche">
              Comment ça marche
            </a>
            {!user && (
              <Link className="landing-nav-link" to="/login">
                Se connecter
              </Link>
            )}
            {user ? (
              <Link className="landing-cta landing-cta--small" to="/app">
                Ouvrir l'app
              </Link>
            ) : (
              <Link className="landing-cta landing-cta--small" to="/register">
                Essayer
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero" id="top">
          {/* Decorative gradient mesh: blurred blobs slowly drifting. */}
          <div className="landing-blobs" aria-hidden="true">
            <span className="landing-blob landing-blob--coral" />
            <span className="landing-blob landing-blob--purple" />
            <span className="landing-blob landing-blob--teal" />
            <span className="landing-blob landing-blob--pink" />
          </div>

          <div className="landing-container landing-hero-inner">
            {/* Deliberately NOT a .reveal: the headline is the page's
                largest first paint, animating it would delay it. */}
            <div className="landing-hero-text">
              <p className="landing-eyebrow">Messagerie d'équipe B2B</p>
              <h1>
                {BRAND} — la messagerie qui <span className="landing-accent">simplifie la communication</span> en entreprise
              </h1>
              <p className="landing-subhead">
                Échangez en temps réel avec vos collègues, partagez vos images et vos PDF, le tout dans une seule app.
              </p>
              <div className="landing-cta-row">
                {primaryCta}
                {!user && (
                  <Link className="landing-secondary-link" to="/login">
                    Déjà un compte ? Se connecter
                  </Link>
                )}
              </div>
            </div>

            <FakeChat />
          </div>
        </section>

        <section className="landing-section" id="fonctionnalites" aria-labelledby="landing-benefits-title">
          <div className="landing-container">
            <p className="landing-kicker reveal">Ce qui est déjà construit</p>
            <h2 id="landing-benefits-title" className="reveal">
              Pas de promesses : ce que l'app fait aujourd'hui.
            </h2>
            <ul className="landing-cards">
              {BENEFITS.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  // Reveal on the <li>, hover lift on the inner card: both
                  // animate `transform`, so they can't share one element.
                  <li key={benefit.title} className={`reveal reveal--d${index + 1}`}>
                    <div className={`landing-card landing-card--${benefit.accent}`}>
                      <span className="landing-card-icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <h3>{benefit.title}</h3>
                      <p>{benefit.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section
          className="landing-section landing-section--tinted"
          id="comment-ca-marche"
          aria-labelledby="landing-steps-title"
        >
          <div className="landing-container">
            <h2 id="landing-steps-title" className="reveal">
              Comment ça marche
            </h2>
            <ol className="landing-steps">
              {STEPS.map((step, index) => (
                <li key={step} className={`landing-step reveal reveal--d${index + 1}`}>
                  {/* The <ol> already announces the position; the big digit is decoration. */}
                  <span className="landing-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-final" aria-labelledby="landing-final-title">
          <div className="landing-container landing-final-inner reveal">
            <h2 id="landing-final-title">Votre équipe, enfin dans la même conversation.</h2>
            <p>Créez un compte, ouvrez un groupe, invitez vos collègues — c'est tout.</p>
            {primaryCta}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div>
            <span className="landing-logo">
              <LogoMark />
              {BRAND}
            </span>
            <p className="landing-brand-line">{BRAND_LINE}</p>
          </div>
          <nav aria-label="Liens de pied de page">
            {/* TODO: point to /pricing once that page exists (see docs/progress.md). */}
            <Link to="/register">Tarifs</Link>
            <a href={REPO_URL}>Code source sur GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// --- Inline icons: decorative (aria-hidden on their wrapper), no icon
// library needed for four shapes. --------------------------------------

function LogoMark() {
  return (
    <svg className="landing-logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" />
      <path d="M9 11.5h14M9 16h9M9 20.5h11" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
