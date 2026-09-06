# Cronos — WhatsApp Scheduled-Messaging Bot (Groups Only)

Self-hosted, multi-tenant web app for scheduling text/media messages to WhatsApp
**groups** (never individual contacts) via linked companion devices (Baileys).

See `/home/luiz/.claude/plans/zesty-singing-cookie.md` for the full design doc
(data model, API contract, session lifecycle, UI wireframe).

## Stack

- Backend: Node.js + Express + TypeScript, Prisma + SQLite, BullMQ + Redis, `@whiskeysockets/baileys`, `ws`
- Frontend: React + TypeScript (Vite)

## Local development

Requires Node 20+ and a running Redis instance.

```bash
npm install

# backend/.env already has sensible dev defaults (SQLite file, local Redis)
npx prisma migrate dev --schema backend/prisma/schema.prisma  # first run only

npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:5173 (proxies /api and /ws to the backend)
```

## Tests

```bash
npm test --workspace backend
```

Covers scheduling edge cases: recurrence → cron conversion (daily/weekly, weekday
mapping, invalid input) and past-date rejection for one-time messages.

## Docker

```bash
cp .env.example .env   # set JWT_SECRET
docker compose up --build
```

This runs Redis + the app (backend serving the built frontend) as two containers.
SQLite data and uploaded media persist in named volumes (`app-data`, `app-media`);
`docker compose down` keeps them, `down -v` removes them.

## Known prototype limitations

- `authState` (Baileys creds) and uploaded media are stored unencrypted — fine for
  a personal/prototype deployment, not for production with untrusted operators.
- No integration test covers a real WhatsApp pairing/send — verified manually
  against WhatsApp's live servers during development, but there's no automated
  test that exercises an actual phone scan or message delivery.
- SQLite is fine for a single-instance prototype; swapping to Postgres for
  multi-instance/production is a one-line `datasource` change in
  `backend/prisma/schema.prisma`.
