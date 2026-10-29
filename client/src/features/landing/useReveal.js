import { useEffect } from "react";

// Scroll reveal for the landing page: every `.reveal` element inside
// rootRef gets `.is-visible` the first time it enters the viewport, and
// Landing.css turns that into a fade + slide-up.
//
// Content is only hidden once this hook has run AND the browser supports
// IntersectionObserver (the root gets `.landing--reveal-ready`): without
// JS, or on an old browser, everything is simply visible from the start.
// Reduced motion is handled in CSS (the hidden state only applies under
// prefers-reduced-motion: no-preference).
export function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          // One-shot: re-hiding on scroll-up would just be distracting.
          observer.unobserve(entry.target);
        }
      },
      // Trigger a bit before the element is fully in view so the motion is
      // already under way when the eye gets there.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );

    root.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    root.classList.add("landing--reveal-ready");

    return () => observer.disconnect();
  }, [rootRef]);
}
