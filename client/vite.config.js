import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// USE_POLLING: bind-mounted volumes (Docker on Mac/Windows) don't always
// forward native filesystem change events reliably into the container.
// Polling is slightly heavier on CPU but 100% reliable on both platforms.
const usePolling = process.env.USE_POLLING !== "false";

// In dev the browser only ever talks to Vite (localhost:5173). Vite forwards
// /api and /socket.io to the api container by its Compose service name.
// Result: same-origin in dev exactly like in production (where Express serves
// the built client) — no CORS, no cookie cross-site issues, ever.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://api:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: { usePolling, interval: 300 },
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/socket.io": { target: apiTarget, ws: true, changeOrigin: true },
    },
  },
});
