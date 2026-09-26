// Compact "Premium" marker shown next to a displayName wherever one already
// renders. CSS-only (no icon library) — a Unicode star is enough for the demo.
export function PlanBadge({ plan }) {
  if (plan !== "PRO") return null;

  return (
    <span className="plan-badge" title="Compte Premium" aria-label="Premium">
      ★
    </span>
  );
}
