# DiceRollers

Jackie Lee's Dice Roll Tracker — a Next.js app for recording dice rolls, tracking drinks, and earning achievements.

## Stack

- **Next.js** (App Router)
- **Supabase** (Postgres, Auth, Realtime)
- **Vercel** (hosting)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Requires a `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Database Migrations

Migrations live in `supabase/migrations/`. Run them in order via the Supabase dashboard SQL editor or CLI.

## Scripts

### Recalculate Achievements

Wipes and recomputes all achievement progress from scratch based on roll history.

```bash
# All users
node --env-file=.env.local scripts/recalculate-achievements.mjs

# Single user
node --env-file=.env.local scripts/recalculate-achievements.mjs --user=<uuid>
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
