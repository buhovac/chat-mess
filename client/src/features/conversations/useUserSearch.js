import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";

const DEBOUNCE_MS = 300;

// Colleague search shared by the "Nouvelle conversation" and "Nouveau groupe"
// dialogs. Two sources, so typing feels instant yet nobody is unreachable:
// - instantly, the first page loaded on open (q="") is filtered in memory;
// - after a pause in typing, the server searches every user (it caps each
//   answer at 20, so filtering the first page alone would miss the rest),
//   and its answer replaces the instant one.
// `settled` is true once the server has answered for the current query, so
// the dialogs don't show "Aucun résultat" while a match may still be coming.
export function useUserSearch(query) {
  const trimmed = query.trim();
  const [firstPage, setFirstPage] = useState([]);
  // Last server answer and the query it belongs to (users is null on error).
  const [answer, setAnswer] = useState(null);

  useEffect(() => {
    // A slower answer to an earlier query must not overwrite the current one.
    let cancelled = false;

    const timeoutId = setTimeout(
      () => {
        api
          .get(`/api/users?q=${encodeURIComponent(trimmed)}`)
          .then((data) => {
            if (cancelled) return;
            if (!trimmed) setFirstPage(data.users);
            setAnswer({ query: trimmed, users: data.users });
          })
          .catch(() => {
            if (!cancelled) setAnswer({ query: trimmed, users: null });
          });
      },
      // Empty query (dialog just opened, or search cleared): no reason to wait.
      trimmed ? DEBOUNCE_MS : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trimmed]);

  const settled = answer?.query === trimmed;

  const results = useMemo(() => {
    if (settled && answer.users) return answer.users;
    // Same rule as the server (server/src/modules/users/service.js): name or
    // email contains the text, case-insensitive. On a server error we keep
    // this instant list rather than emptying it.
    const needle = trimmed.toLowerCase();
    return firstPage.filter(
      (user) => user.displayName.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle),
    );
  }, [settled, answer, trimmed, firstPage]);

  return { results, settled };
}
