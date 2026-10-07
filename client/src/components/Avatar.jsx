// Option 1 from the account-settings stage: no uploaded image, just
// initials on a colored circle — zero backend, zero storage. The color is
// derived from the user id (not the name) so it stays the same after a
// rename. Colors are a fixed set of CSS classes rather than an inline
// style, keeping the markup inside the CSP's style-src 'self'.
const COLOR_COUNT = 8;

function initialsOf(displayName = "") {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function colorIndexOf(id = "") {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % COLOR_COUNT;
}

export function Avatar({ user, size = "md" }) {
  return (
    <span className={`avatar avatar--${size} avatar--c${colorIndexOf(user.id)}`} aria-hidden="true">
      {initialsOf(user.displayName)}
    </span>
  );
}
