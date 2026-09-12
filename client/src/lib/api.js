// credentials: "include" is what makes the browser send the httpOnly "token"
// cookie on same-origin requests (dev: via the Vite proxy, prod: same origin
// for real since Express serves both).
async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.error?.message ?? "Request failed";
    throw new Error(message);
  }

  return body;
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
};
