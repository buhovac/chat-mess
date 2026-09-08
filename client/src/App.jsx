import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// Proves the whole loop works: browser -> Vite proxy -> api container ->
// Postgres, and back over a real WebSocket. Relative URLs on purpose: same
// origin in dev (Vite proxy) and in prod (Express serves this app).
// Delete once you start building actual features — this is scaffolding.
export default function App() {
  const [health, setHealth] = useState("checking...");
  const [pong, setPong] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setHealth(data.ok ? "API + DB OK" : `error: ${data.error}`))
      .catch((err) => setHealth(`unreachable: ${err.message}`));

    const socket = io(); // same origin, /socket.io proxied to the api
    socket.emit("ping:test", { hello: "from client" });
    socket.on("pong:test", (data) => setPong(data));
    return () => socket.disconnect();
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>chat-mess — environnement de dev</h1>
      <p>Santé API/DB : <b>{health}</b></p>
      <p>Aller-retour WebSocket : <b>{pong ? JSON.stringify(pong) : "en attente..."}</b></p>
    </main>
  );
}
