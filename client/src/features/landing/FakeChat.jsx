import { useEffect, useRef } from "react";
import { Avatar } from "../../components/Avatar.jsx";

// A live-looking ChatMess window for the landing hero, instead of a static
// screenshot. Built from the app's real pieces (Avatar, bubble shapes,
// "own" bubble color) so it actually looks like the product.
//
// The message sequence (bubbles in, typing dots, last bubble) is pure CSS —
// see .fakechat-* in Landing.css. The only JS here is the optional tilt.

// Fixed ids: Avatar derives its color from the id, so these pin two
// distinct colors from the app's avatar palette.
const ANYSSA = { id: "a", displayName: "Anyssa Martin" };
const MARKO = { id: "m", displayName: "Marko B" };

const MAX_TILT_DEG = 4;

export function FakeChat() {
  const windowRef = useRef(null);

  // Slight 3D tilt following the mouse. Only on devices with a real
  // pointer (no point on touch) and when the user hasn't asked for reduced
  // motion. setProperty() goes through the CSSOM, which the server's CSP
  // (style-src 'self') allows — unlike a style="..." attribute in markup.
  useEffect(() => {
    const element = windowRef.current;
    const canTilt =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!element || !canTilt) return;

    let frame = null;
    function handlePointerMove(event) {
      // At most one style write per frame, however fast the mouse moves.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const x = event.clientX / window.innerWidth - 0.5; // -0.5 .. 0.5
        const y = event.clientY / window.innerHeight - 0.5;
        element.style.setProperty("--tilt-x", `${(x * MAX_TILT_DEG * 2).toFixed(2)}deg`);
        element.style.setProperty("--tilt-y", `${(-y * MAX_TILT_DEG * 2).toFixed(2)}deg`);
      });
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <figure className="fakechat">
      {/* Screen readers get this one sentence instead of a fake
          conversation read out bubble by bubble. */}
      <figcaption className="visually-hidden">
        Aperçu de ChatMess : une conversation de groupe où des messages arrivent en temps réel.
      </figcaption>

      <div className="fakechat-window" ref={windowRef} aria-hidden="true">
        <div className="fakechat-header">
          <span className="fakechat-title">Équipe Produit</span>
          <span className="fakechat-presence">
            <span className="presence-dot presence-dot--online" />3 en ligne
          </span>
        </div>

        <ul className="fakechat-messages">
          <li className="fakechat-row fakechat-step fakechat-step--1">
            <Avatar user={ANYSSA} size="md" />
            <div className="fakechat-bubble">
              <span className="fakechat-sender">Anyssa Martin</span>
              <p>La démo client est à 14h — quelqu'un a la dernière version du deck ?</p>
              <span className="fakechat-time">il y a 2 min</span>
            </div>
          </li>

          <li className="fakechat-row fakechat-row--own fakechat-step fakechat-step--2">
            <div className="fakechat-bubble fakechat-bubble--own">
              <span className="fakechat-sender">Marko B</span>
              <p>Je viens de la mettre dans le groupe, tu l'as en PDF juste au-dessus 👆</p>
              <span className="fakechat-time">il y a 1 min</span>
            </div>
          </li>

          {/* Typing dots and the last bubble share one grid cell: the dots
              fade out exactly as the bubble fades in, with no layout jump. */}
          <li className="fakechat-row fakechat-last">
            <div className="fakechat-typing">
              <Avatar user={ANYSSA} size="md" />
              <span className="fakechat-dots">
                <span />
                <span />
                <span />
              </span>
            </div>
            <div className="fakechat-final">
              <Avatar user={ANYSSA} size="md" />
              <div className="fakechat-bubble">
                <span className="fakechat-sender">Anyssa Martin</span>
                <p>Parfait, merci ! Je préviens le client.</p>
                <span className="fakechat-time">à l'instant</span>
              </div>
            </div>
          </li>
        </ul>

        <div className="fakechat-composer">
          <span>Écrire un message...</span>
          <span className="fakechat-send">Envoyer</span>
        </div>
      </div>
    </figure>
  );
}
