> Izvor istine za roadmap Projekta 1. HTML verzija (ljepša) je artifact "Trajectoire P1" u Cowork projektu "Dev-Integration"; ovaj markdown je za agente i buduće sesije. Generisano 2026-09-04.


5IDEV · Projet 1 — Roadmap

# Trajectoire P1 — roadmap u etapama

Kompletan plan za B2B real-time messaging aplikaciju, od praznog repoa do odbranjenog projekta. Svaka etapa isporučuje nešto novo što se može pokazati u produkciji, ima **brief za agenta** koji možeš direktno proslijediti, i **kriterije prihvatanja** koje ti sam provjeravaš prije nego što ideš dalje.

**Etape:** 10 (0–9)

**Rok predaje:** pon 2. nov 2026, 23:59

**Revije:** S3 · S5 · S7 (napomena: profesor je Reviju #1 zakazao ranije nego što je ovaj plan pretpostavljao — vidi `CLAUDE.md` "État actuel" i dnevnik za tačan datum)

**Stack:** Node · Express · Socket.IO · React · Postgres · Prisma

**Hosting:** Railway

**Tim:** Marko (Mac) · Anyssa (Win)

## 01 · Kako raditi sa agentom, etapa po etapu

Ovo je operativni protokol. Poenta nije da agent napiše kod — to će on lako. Poenta je da ti na kraju svake etape možeš reći *šta* radi, *zašto* tako, i *kako znaš* da radi. To je ono što se ocjenjuje usmeno, i ono što kurs izričito traži: „vous devez comprendre et valider chaque ligne".

### Petlja za svaku etapu

1.  **Pročitaj etapu do kraja** prije nego što otvoriš agenta — posebno „Šta moraš razumjeti" blok.
2.  **Zalijepi opšti preambul** (ispod) + brief etape. Traži od agenta da prvo vrati *plan i listu fajlova*, pa tek onda kod. Ako plan ne razumiješ, pitaj — ne prihvataj.
3.  **Jedna feature grana po etapi ili pod-etapi**: `feature/e3-direct-messages`. Agent radi na grani, ti pregledaš diff prije svakog commita.
4.  **Pokreni kriterije prihvatanja ručno**, u browseru, na lokalnom Dockeru — svaki ☐ u listi. Onda pokreni testove.
5.  **PR → kolegica pregleda → merge u main → automatski deploy.** Provjeri istu stvar na produkcijskom URL-u.
6.  **Screenshot + dnevnik**: 1–2 slike za rapport, 2–3 rečenice u dnevnik poteškoća (datum, problem, rješenje).

### Pravila koja agentu ne dozvoljavaš da prekrši

- Nikad ne dira `.env`, ne hardkodira tajne, ne komituje ključeve.
- Svaka provjera prava pristupa ide kroz **jedan** modul (`policies/authorize.js`) — nema „inline" if-ova po kontrolerima.
- Svaki ulaz od korisnika validiran (zod) na serveru, bez obzira na frontend.
- Ne mijenja već primijenjene Prisma migracije — dodaje nove.
- Ne uvodi nove servise/infrastrukturu (Redis, S3, queue) bez tvog eksplicitnog „da".
- Piše testove za ono što etapa navodi — ne „kasnije".

**Opšti preambul za agenta (zalijepi ispred svakog briefa)**

    PROJECT CONTEXT
    - School project (5IDEV, Ifosup): B2B real-time team messaging app (Slack-like). Team of 2, ~7 weeks, graded on
      working production deployment, code quality, report and oral defense. I must understand every line you write.
    - Stack (fixed, do not propose alternatives): Node.js 22 (ESM), Express 4, Socket.IO 4, Prisma 6 + PostgreSQL 16,
      React 18 + Vite 5, plain CSS or Tailwind (ask before adding a UI library). Deployed on Railway from a single
      production Dockerfile (Express serves the built React app + API + WebSocket on one port).
    - Local dev: Docker Compose (services: db, adminer, api, client). Source is bind-mounted; node_modules live in
      named volumes. NEVER run npm install on the host — always `docker compose exec api|client npm install <pkg>`.
    - Repo layout: /server (src/config, src/lib, src/middleware, src/modules/<feature>/{router,service,schema}.js,
      src/policies/authorize.js, src/sockets/, prisma/), /client (src/app, src/features/<feature>, src/components,
      src/lib/api.js, src/lib/socket.js, src/pages).

    CONVENTIONS
    - Validate every request body/params with zod schemas in modules/<feature>/schema.js. Return errors as
      { error: { code, message } } with proper HTTP status; never leak stack traces.
    - All authorization decisions go through src/policies/authorize.js (pure functions, unit-tested).
    - Socket.IO handlers reuse the same services + policies as REST. Rooms: `user:<id>` and `conversation:<id>`.
    - Tests: Vitest (+ supertest for HTTP). Put tests next to code as *.test.js. Tests must run with `npm test`
      inside the api container against the Compose Postgres (DATABASE_URL already set).
    - Small, reviewable commits with conventional messages (feat:, fix:, test:, chore:). No secrets, no .env changes.
    - Comments explain WHY, briefly. No dead code, no TODOs left behind.

    HOW TO WORK
    1) First reply with a short plan + list of files you will create/modify + any question. Wait for my OK.
    2) Then implement. 3) Tell me exactly how to test manually and what `npm test` should print.
    4) If something in the brief conflicts with the existing code, stop and ask.

    STAGE BRIEF FOLLOWS.

## 02 · Etape

Svaka etapa ima istu strukturu: šta isporučuje, zašto baš tako, brief za agenta (EN), kriterije prihvatanja koje ti provjeravaš, šta moraš razumjeti da to možeš odbraniti, i šta ide u rapport.

### Etapa 0 — Fondacije: repo, proces, lokalno okruženje ✅ (urađeno)

**Isporučuje** Javni GitHub repo sa zaštićenom `main` granom, Docker Compose okruženje koje radi na oba laptopa, validiran stack + hoster od profesora, popunjena grille d'hébergement predata na Teams, rapport poglavlja 1 i 2 u prvoj verziji.

**Šta moraš razumjeti:** zašto node_modules žive u kontejneru a ne na disku (native binari po OS-u); šta radi bind mount; razlika `Dockerfile.dev` vs produkcijski `Dockerfile` (multi-stage); zašto Vite proxy uklanja CORS problem (same-origin); šta znači „main = production" u GitHub Flow.

### Etapa 1 — CI/CD i prva produkcija ✅ (dio urađen: Railway live; GitHub Actions CI još nije dodan)

**Isporučuje** Javni URL na Railway-u koji servira skeleton aplikaciju; GitHub Actions koji na svaki PR pokreće lint + build + test; merge u `main` automatski deploya; migracije se primjenjuju pri startu; tajne isključivo u Railway env vars.

**Brief za agenta — E1 (ostatak: GitHub Actions CI)**

    STAGE 1 (remaining part) — GitHub Actions CI. No product features.
    1. server/package.json: confirm "prisma" is in dependencies (not devDependencies), "start" is
       "prisma migrate deploy && node src/index.js". Add "test": "vitest run" and install vitest + supertest (dev).
       Add one real test: GET /api/health returns 200 and { ok: true } (supertest against the Express app —
       export the app from src/app.js and keep listen() in src/index.js so tests don't open a port).
    2. .github/workflows/ci.yml: on pull_request and push to main. Jobs:
       - server: node 22, postgres:16 service (POSTGRES_USER/PASSWORD/DB=app), env DATABASE_URL pointing at it,
         `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run lint`, `npm test`.
       - client: node 22, `npm ci`, `npm run lint`, `npm run build`.
       Use actions/setup-node cache for npm. Fail fast, concurrency group per branch.
    3. Add server/src/config/env.js that reads and validates required env vars with zod at boot
       (DATABASE_URL, JWT_SECRET min 32 chars in production, PORT default 3001, NODE_ENV) and exits with a clear
       message if missing. Import it first in src/index.js.
    Tell me which two checks to mark "required" in GitHub branch protection once they're green.

**Kriteriji prihvatanja:** otvoren PR pokazuje dva checka (server, client); namjerno pokvaren lint → crveni check → merge blokiran. `git log -p | grep -i secret` ne nalazi ništa.

**Šta moraš razumjeti:** šta CI radi na PR-u vs šta CD radi na merge-u; zašto se migracije primjenjuju pri startu a ne pri buildu; šta je `services:` u GitHub Actions; zašto validirati env varijable pri bootu.

### Etapa 2 — Model podataka i autentikacija

**Isporučuje** Kompletna Prisma šema MVP-a (User, Conversation, ConversationMember, Message) sa migracijom; registracija i login sa JWT u httpOnly cookie-ju; zaštićene rute; Socket.IO handshake koji odbija neautentikovane; React: stranice Login/Register, app shell (sidebar + glavni panel, responsive) i zaštićene rute.

#### Model podataka — odluke koje treba da znaš odbraniti

Šema se pravi cijela odmah (ne tabelu po tabeli kroz etape) jer se migracije teško „prepravljaju" kad dvoje radi paralelno, a UML dijagram klasa u rapportu treba da odgovara bazi. Evo modela i *zašto*:

- **User** — `id, email @unique, passwordHash, displayName, avatarUrl?, plan (FREE|PRO, default FREE), createdAt`. `plan` ide na usera već sada da Etapa 6 (pricing) ima gdje da stane.
- **Conversation** — `id, type (DIRECT|GROUP), name? (samo GROUP), directKey? @unique, createdById, createdAt, updatedAt`. `directKey` = `"<manjiUserId>:<većiUserId>"` garantuje na nivou baze da postoji tačno jedan DM između dvoje ljudi — to je pravilo integriteta koje ide u rapport 3.4.
- **ConversationMember** — `@@id([conversationId, userId]), role (OWNER|ADMIN|MEMBER), joinedAt, lastReadAt`. Pivot tabela N-N sa dodatnim podacima. `lastReadAt` je ključ za unread brojače u Etapi 5 — bez posebne Notification tabele.
- **Message** — `id, conversationId, senderId, content, createdAt, editedAt?, deletedAt?`, `@@index([conversationId, createdAt])` jer se istorija uvijek čita „po konverzaciji, hronološki". `deletedAt` = soft delete.
- Kaskade: brisanje User-a → briše njegove membership-e; brisanje Conversation → briše members i messages. Brisanje usera *ne* briše njegove poruke u grupama (senderId postaje null) — odluka koju treba zapisati.

#### Auth — zašto JWT u httpOnly cookie-ju

Tri opcije: session u bazi, JWT u localStorage, JWT u httpOnly cookie. LocalStorage je čitljiv iz JS-a (XSS rizik) i kurs ocjenjuje sigurnost. Session u bazi je najsigurnija ali traži dodatnu tabelu i cleanup. httpOnly cookie sa JWT-om: nije dostupan JS-u, automatski ide i na HTTP i na Socket.IO handshake, i zahvaljujući same-origin arhitekturi nema cross-site komplikacija. `SameSite=Lax`, `Secure` u produkciji, trajanje 7 dana. Lozinke: `bcrypt` cost 12.

**Brief za agenta — E2**

    STAGE 2 — data model + authentication. Two PRs: (a) schema, (b) auth.

    (a) SCHEMA. Replace the placeholder Prisma schema with:
      enum ConversationType { DIRECT GROUP }   enum MemberRole { OWNER ADMIN MEMBER }   enum Plan { FREE PRO }
      User(id String @id @default(cuid()), email String @unique, passwordHash String, displayName String,
           avatarUrl String?, plan Plan @default(FREE), createdAt DateTime @default(now()))
      Conversation(id, type ConversationType, name String?, directKey String? @unique, createdById String,
           createdAt, updatedAt @updatedAt)  — relation createdBy -> User (onDelete: SetNull → make createdById optional)
      ConversationMember(conversationId, userId, role MemberRole @default(MEMBER), joinedAt @default(now()),
           lastReadAt DateTime @default(now()))  @@id([conversationId, userId]); cascade on both FKs
      Message(id, conversationId, senderId String?, content String, createdAt @default(now()), editedAt DateTime?,
           deletedAt DateTime?)  @@index([conversationId, createdAt]); conversation cascade; sender onDelete: SetNull
      Create the migration (`prisma migrate dev --name init_mvp`). Add prisma/seed.js creating 3 users
      (password "password123") and wire "prisma.seed" in package.json. Document the model in docs/data-model.md
      with a Mermaid erDiagram — I will reuse it for the UML chapter.

    (b) AUTH.
      - src/lib/prisma.js (singleton), src/lib/jwt.js (sign/verify HS256, 7d), src/lib/password.js (bcrypt 12).
      - modules/auth: POST /api/auth/register {email, password(min 8), displayName}, POST /api/auth/login,
        POST /api/auth/logout, GET /api/auth/me. On success set cookie "token" httpOnly, sameSite=lax,
        secure=NODE_ENV==="production", maxAge 7d. Generic "invalid credentials" message (no user enumeration).
      - middleware/requireAuth.js: reads cookie, verifies, attaches req.user {id, email, displayName, plan}; 401 otherwise.
      - Socket.IO: middleware that parses the cookie from handshake headers, verifies JWT, sets socket.data.user,
        rejects with an Error("unauthorized") otherwise. On connect, join room `user:<id>`.
      - Rate limit auth routes (express-rate-limit, 20/15min/IP). Add helmet with sane defaults.
      - Tests (vitest+supertest): register → 201 + cookie; duplicate email → 409; login wrong password → 401;
        /me without cookie → 401, with cookie → 200; socket connection without cookie is rejected.
      - Client: src/lib/api.js (fetch wrapper, credentials:"include", throws on error JSON), AuthProvider
        (loads /me on boot), pages Login/Register with validation messages, ProtectedRoute, AppShell layout
        (left sidebar 280px, main panel; collapses to a single column under 768px with a back button pattern).
        Router: / (temporary redirect to /app), /login, /register, /app. Log out button in the shell.
      - Keep styling minimal but clean (CSS modules or one global stylesheet with CSS variables). No UI kit yet.

**Kriteriji prihvatanja:**
- Registracija novog korisnika → automatski ulogovan → refresh stranice ostaje ulogovan (cookie radi).
- Pogrešna lozinka i nepostojeći email daju *istu* poruku greške.
- U DevTools → Application → Cookies: `token` ima HttpOnly ✓; `document.cookie` u konzoli ga ne pokazuje.
- Neulogovan pristup `/app` vodi na `/login`; `curl /api/auth/me` bez cookie-ja → 401.
- U Adminer-u vidiš tabele `User, Conversation, ConversationMember, Message` i seed korisnike; lozinke su hash, ne tekst.
- Na telefonu (ili DevTools responsive) shell se skuplja u jednu kolonu.
- `npm test` zelen; isto ponašanje na produkcijskom URL-u nakon merge-a.

**Šta moraš razumjeti:** šta je u JWT-u i zašto se ne može falsifikovati bez tajne (a zašto se *može* pročitati); httpOnly vs localStorage i XSS; zašto `directKey` rješava duple DM-ove na nivou baze a ne u kodu (race condition); šta je pivot tabela sa payloadom; soft delete vs cascade; zašto `@@index([conversationId, createdAt])`.

**Za rapport / Reviju #1:** poglavlje 3.2 (UML klasa — iz Mermaid ERD-a), 3.3 tabele i relacije, 3.4 pravila integriteta. Screenshot Login/Register + shell.

### Etapa 3 — 1:1 konverzacije i poruke u realnom vremenu

**Isporučuje** Korisnik pronađe kolegu, otvori DM, pošalje poruku — i ona se pojavi kod druge osobe bez refresha. Istorija poruka se učitava sa paginacijom. Lista konverzacija u sidebaru sa zadnjom porukom. Ovo je srce projekta: prva prava „real-time" funkcionalnost.

#### Arhitektura real-time dijela — hibrid REST + Socket.IO

Pravilo koje pojednostavljuje sve: **čitanje istorije ide preko REST-a, živi događaji preko socket-a.** Slanje poruke ide *preko socket-a sa ack callbackom* — klijent dobije potvrdu (ili grešku) za baš tu poruku, što omogućava optimistic UI: poruka se prikaže odmah sivo, pa postane „potvrđena" kad stigne ack sa pravim `id`-jem iz baze.

Tok jedne poruke: klijent `emit("message:send", {conversationId, content, clientTempId}, ack)` → server provjeri da je pošiljalac član (`authorize`) → validira sadržaj (1–4000 znakova, trim) → `INSERT` → `io.to("conversation:<id>").emit("message:new", message)` → `ack({ ok: true, message })`.

**Paginacija istorije:** cursor-based (`?before=<messageId>&limit=50`), ne offset.

**Brief za agenta — E3**

    STAGE 3 — direct (1:1) conversations + real-time messages. Two PRs.

    (a) CONVERSATIONS + HISTORY (REST).
      - src/policies/authorize.js: export pure functions `canReadConversation(user, membership)`,
        `canPostMessage(user, membership)` (member of conversation, not deletedAt) — extend later. Unit tests.
      - modules/users: GET /api/users?q=<search> (displayName/email contains, excludes self, max 20).
      - modules/conversations:
          GET  /api/conversations → user's conversations ordered by last activity, each with: id, type, name
               (for DIRECT, name = other member's displayName), members (id, displayName), lastMessage
               (content preview, createdAt, senderId). Single query with includes; no N+1.
          POST /api/conversations { type:"DIRECT", userId } → find-or-create by directKey (sorted ids joined
               with ":"); create Conversation + 2 members in one transaction. Return existing one if present.
          GET  /api/conversations/:id → 404 if not member (do not reveal existence).
      - modules/messages: GET /api/conversations/:id/messages?before=<id>&limit=50 → newest-first page,
        returned oldest-first; include sender {id, displayName}. Cursor = message id (createdAt tiebreak).
      - Tests: non-member gets 404 on GET conversation and messages; directKey dedup (two POSTs → same id);
        pagination returns correct page boundaries.

    (b) REAL-TIME (Socket.IO).
      - src/sockets/index.js: on connection (already authenticated in E2) load user's conversation ids and
        socket.join(`conversation:<id>`) for each. Export a helper `joinConversationRooms(userId, conversationId)`
        that makes all sockets in room `user:<id>` join a new conversation room (use io.in(...).socketsJoin).
      - Handler "message:send" ({conversationId, content, clientTempId}, ack): validate with zod, authorize,
        create via messages service (shared with REST), emit "message:new" to the conversation room,
        ack({ ok:true, message }) or ack({ ok:false, error:{code,message} }). Never throw out of a handler.
      - When a DIRECT conversation is created via REST, call joinConversationRooms for both users and emit
        "conversation:new" to both `user:<id>` rooms so the sidebar updates live.
      - Client: src/lib/socket.js (singleton io() with autoConnect after auth, reconnection on); features/
        conversations (sidebar list, "new message" dialog with user search), features/messages (message list
        with reverse-infinite-scroll, composer with Enter to send / Shift+Enter newline, optimistic pending state
        keyed by clientTempId, error toast on failed ack). Scroll to bottom on new message if user is near bottom.
        Show sender name + time; group consecutive messages from same sender within 5 minutes.
      - Tests: socket integration test with socket.io-client: two authenticated clients, A sends, B receives
        "message:new"; a non-member never receives it.

**Kriteriji prihvatanja (testiraj sa dva browsera / jedan incognito):**
- Kao A: „Nova poruka" → pretraga „Anyssa" → otvara DM. Ponovni pokušaj otvara *istu* konverzaciju (nema duplikata).
- A šalje poruku → kod B se pojavi u <1s bez refresha; kod A prvo siva (pending), pa potvrđena.
- B odgovori dok A gleda drugu konverzaciju → sidebar kod A pomjeri tu konverzaciju na vrh sa novim previewom.
- Isključi WiFi 10s pa uključi → socket se sam rekonektuje, poruke poslate za to vrijeme daju grešku, ne „nestaju" tiho.
- Pošalji 60+ poruka (seed skripta može) → scroll na vrh učitava starije, bez duplih i bez „skakanja".
- Treći korisnik C, koji nije član, ne dobija ništa.
- Prazna poruka / 5000 znakova → odbijeno na serveru (ne samo disabled dugme).

**Šta moraš razumjeti:** Socket.IO sobe (room); ack callback i zašto omogućava optimistic UI; razlika emit-a na sobu vs na jedan socket; cursor vs offset paginacija; zašto autorizacija ide i u socket handler iako REST već provjerava; šta se dešava sa socket-om pri reconnection-u.

**Za rapport / Reviju #1:** poglavlje 3.5 (fonctionnement du temps réel), 3.1 shema arhitekture. Screenshot dva prozora jedan pored drugog. Demo: DM u realnom vremenu na produkciji sa dva uređaja.

---

*(Etape 4–9 — grupe/permisije, notifikacije/presence, landing/pricing, full-text pretraga, kvalitet/testovi, rapport final — dodati ovdje kad se stigne do njih; kompletan tekst postoji u Cowork projektu "Dev-Integration" ako zatreba prije toga.)*

## 03 · Env varijable

| Ime             | Gdje                                             | Napomena                                      |
|-----------------|--------------------------------------------------|------------------------------------------------|
| DATABASE_URL    | Compose (auto) · Railway (auto, Postgres plugin) | nikad u repou                                 |
| JWT_SECRET      | .env lokalno · Railway variables                 | ≥ 32 znaka u produkciji, validirano pri bootu |
| NODE_ENV        | Railway = production                             | uključuje static serving + secure cookie      |
| PORT            | Railway injektuje                                | default 3001                                  |

Trajectoire P1 · izvedeno iz: cours.tsix.be (Projet 1), canevas Rapport_projet_5IDEV.docx, p1-devkit scaffold. Rok 2. 11. 2026 fiksan.
