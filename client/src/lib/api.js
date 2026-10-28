// credentials: "include" is what makes the browser send the httpOnly "token"
// cookie on same-origin requests (dev: via the Vite proxy, prod: same origin
// for real since Express serves both).
async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  return parseResponse(res);
}

async function parseResponse(res) {
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(body?.error?.message ?? "Request failed");
    // Lets callers show a message per case (e.g. FILE_TOO_LARGE) instead of
    // the server's English text.
    error.code = body?.error?.code;
    error.status = res.status;
    throw error;
  }

  return body;
}

// Multipart upload: no Content-Type header on purpose — the browser sets
// "multipart/form-data; boundary=..." itself, and forcing application/json
// (like request() does) would make the server unable to read the file.
async function upload(path, formData) {
  const res = await fetch(path, { method: "POST", credentials: "include", body: formData });
  return parseResponse(res);
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: "PATCH", body: JSON.stringify(data) }),
  // Optional body: DELETE /api/account needs the current password.
  del: (path, data) => request(path, { method: "DELETE", ...(data ? { body: JSON.stringify(data) } : {}) }),
  upload,
};
