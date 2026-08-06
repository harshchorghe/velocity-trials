# Velocity Trials — Backend

Express + TypeScript API and gesture WebSocket, backed by SQLite via Prisma.

The server is **authoritative**: clue answers, the final secret code, weapon
damage and every qualification decision live here, not in the browser bundle.
The frontend reports intent ("I collected crystal 2"); the server decides what
that is worth and whether it counts.

## Running

```bash
npm install
npx prisma migrate deploy   # first run only
npm run seed                # clue codes + final secret code
npm run dev                 # http://localhost:4000
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | watch mode |
| `npm run build` / `npm start` | compile to `dist/` and run |
| `npm run seed` | (re)seed clues and the secret code |
| `npm run db:reset` | wipe the database and reseed — clears event progress |
| `npm run db:studio` | browse the data |
| `npm run test:race` | concurrency suite (see below) |

## Auth

`POST /api/register` returns a `token`. Send it as `Authorization: Bearer <token>`
on every other route. Registration is keyed on roll number, so reloading the
portal resumes the same run rather than starting a new one.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/register` | register/login, returns token + session |
| `GET` | `/api/session` | full progress snapshot |
| `GET` | `/api/level1/clues` | locked clues return `text: null` |
| `POST` | `/api/level1/clue` | `{clueIndex, code}` — must be solved in order |
| `POST` | `/api/level1/code` | `{code}` — final gesture code, triggers qualification |
| `GET` | `/api/level2` | power, lives, crystals |
| `POST` | `/api/level2/crystal` | `{crystalIndex}` — idempotent |
| `POST` | `/api/level2/hazard` | `{hazard}` — costs a life, rate limited |
| `POST` | `/api/level3/weapon` | `{weapon}` — locked once chosen |
| `POST` | `/api/level3/action` | `{action, seq}` — `seq` makes retries safe |
| `GET` | `/api/leaderboard` | derived scores, ranked |
| `GET` | `/api/leaderboard/stats` | totals and remaining qualification slots |
| `POST` | `/api/admin/login` | `{password}` → admin token (checked against `ADMIN_PASSWORD`) |
| `GET` | `/api/admin/agents` | full registrations incl. phone — admin token required |

This process also serves the game itself at `/` and the admin dashboard at
`/dashboard`, so [localhost:4000](http://localhost:4000) is the whole app on
one origin. The
pages still work from a separate static server; they fall back to calling
`:4000` cross-origin, which CORS permits.

`ws://localhost:4000/ws/gesture?token=<token>` streams MediaPipe hand landmarks
up and classification down. Confirmed digits accumulate into a **server-side**
buffer and auto-submit through the same validated path as `/api/level1/code`.

## Concurrency

Every player shares one world, so simultaneous writes are the normal case, not
an edge case. Three layers handle it:

1. **Database constraints** are the real guarantee. Unique indexes on
   `ClueSolve(level1Id, clueIndex)`, `CrystalCollect(level2Id, crystalIndex)` and
   `BossHit(level3Id, seq)` make replays and double-submits impossible to
   double-count — the second insert fails and the service returns existing state.
   `GameSession.activeMarker` is a unique column holding the player id while a
   session is live, which enforces "one active session per player" in SQLite
   itself.
2. **Guarded single-statement updates** for counters, e.g. lives are decremented
   with `where: { lives: { gt: 0 } }` so the database refuses to go negative
   rather than trusting a value read a moment earlier.
3. **A keyed async mutex** (`src/lib/mutex.ts`) serializes read-decide-write
   sequences per session, and globally for the qualification brackets so the
   10th and 11th player finishing in the same tick cannot both be admitted.

`npm run test:race` fires genuinely simultaneous requests at a live server and
asserts on the persisted rows — duplicate collection, negative lives, overfilled
brackets, replayed finishing blows, and double-crowned champions. It runs
against a throwaway `prisma/race-test.db`, never your dev data.

## Game rules

Configured in `src/game/constants.ts`: 3 clues, a 4-digit gesture code, 3
crystals, 3 lives, the first 10 finishers clear Level 1, the first 2 clear
Level 2, and the first finalist to fell the Overlord is champion.
