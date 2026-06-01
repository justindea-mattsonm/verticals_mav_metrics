# verticals_mav_metrics

Custom dashboard for Justin's verticals program (Sanctum / Vigil / Panacea).

```
Hex (compute)  →  Neon Postgres (storage)  →  Vercel / Next.js (dashboard)
```

Hex runs nightly, writes 5 dataframes into Neon. The Next.js app on Vercel
reads from Neon and renders dashboards. ISR caches each route for 1 hour.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- `pg` driver against Neon Postgres (provisioned via Vercel ↔ Neon Marketplace)
- Light theme everywhere (white background, dark text)
- All versions pinned; respects the workspace 3-day package-cooldown rule

## First-time setup

This assumes the Vercel project is already created (see "Vercel link" below).

1. **Add Neon storage to the Vercel project.**
   In the Vercel dashboard → project `verticals-mav-metrics` → **Storage** →
   **Create Database** → **Neon**. Use the default region. The integration
   auto-injects `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGUSER`,
   `PGPASSWORD`, `PGDATABASE` into the project's env vars.

2. **Pull env vars locally.**
   ```bash
   vercel env pull .env.development.local
   ```
   This writes the Vercel-managed env values into a local file (gitignored).

3. **Install deps.**
   ```bash
   npm install
   ```

4. **Run the schema migration against Neon.**
   ```bash
   npm run migrate
   ```
   Creates 5 tables + a `_migrations` log. Idempotent — safe to re-run.

5. **Copy `DATABASE_URL` into a Hex Workspace Secret.**
   - Open `.env.development.local`, copy the value of `DATABASE_URL`.
   - In Hex → **Settings → Secrets** → add secret named `NEON_WRITEBACK_URL`
     with that value. (Hex can't pull from Vercel — one-time manual copy.)

6. **Set up the Hex writeback.**
   Open the Hex project "Sparta Dash V2 — owner-based rollups", launch the
   in-app agent, and paste the contents of [`prompts/hex_setup_writeback.md`](prompts/hex_setup_writeback.md).
   The agent creates the writeback CODE cell (and, if needed, two new
   DataFrame SQL cells). Run the cell once to seed Neon; then schedule the
   project nightly.

7. **Verify.**
   ```bash
   npm run dev
   open http://localhost:3000/sparta
   ```
   You should see freshness / overview / trailing-metrics / staffing
   sections, all populated.

8. **Deploy.**
   The repo is linked to Vercel; pushes to `main` (or merged PRs) deploy
   automatically. For an explicit preview deploy:
   ```bash
   vercel
   ```

## Routes

| Route | What it shows |
|---|---|
| `/` | Index of available dashboards |
| `/sparta` | Sparta operational rollups (WIP, throughput, AHT, approval rate, staffing) |

Add new dashboards as new routes under `app/<slug>/page.tsx`. Each route
should be a Server Component with `export const revalidate = 3600;` for ISR.

## Data model

Five tables, each with a `_built_at TIMESTAMPTZ` column populated by the Hex
writeback. Schema is in [`db/migrations/0001_initial.sql`](db/migrations/0001_initial.sql).

| Table | Grain | Primary key |
|---|---|---|
| `overview_rollup_current_values` | per (world_type, stage) snapshot | `(world_type, stage)` |
| `rollup_metrics_trailing_14d` | per (world_type, rollup_stage, day_anchor) | `(day_anchor, world_type, rollup_stage)` |
| `staffing_user_rollup` | per expert | `(user_id)` |
| `wip_active_aht_by_rollup` | per (world_type, rollup_stage) | `(world_type, rollup_stage)` |
| `completed_active_aht_by_rollup` | per (world_type, rollup_stage) | `(world_type, rollup_stage)` |

Adding a new table:

1. Write `db/migrations/0002_<name>.sql` (idempotent CREATE TABLE IF NOT EXISTS).
2. `npm run migrate`.
3. Add a typed loader in `lib/queries.ts`.
4. Add a writeback entry in `prompts/hex_setup_writeback.md` and paste into Hex.

## Local dev tips

- Server Components read env at request time; restart `npm run dev` after
  changing `.env.development.local`.
- `vercel env pull .env.development.local --environment=production` if you
  want to read against the production DB locally (be careful).
- Tail the dev server logs to see SQL errors — `tableExists()` makes the page
  degrade gracefully if a table is missing, but other DB errors will surface
  in console.

## Vercel link (if not yet linked)

The repo should already be linked to a Vercel project named
`verticals-mav-metrics`. If `.vercel/` is missing or `vercel inspect` errors:

```bash
vercel login            # if not authed
vercel link --project verticals-mav-metrics --yes
```

## Operational discipline

- **Don't commit `.env*` files.** `.env.example` is the only env file
  in-repo. Everything else is gitignored.
- **Don't deploy to production until the Hex writeback has populated Neon
  at least once.** Preview deploys are safe — empty tables render as empty
  states (`EmptyState`).
- **Don't bump package versions casually.** The workspace enforces a 3-day
  cooldown on package installs (see top-level `~/.claude/CLAUDE.md`). Pin
  exact versions and verify publish age before adding.
- **Light theme only.** White backgrounds, dark text. No dark-mode toggle
  unless explicitly scoped.

## Layout

```
verticals_mav_metrics/
├── app/
│   ├── layout.tsx           # global shell + header/footer
│   ├── globals.css          # Tailwind + base styles
│   ├── page.tsx             # landing route (index of dashboards)
│   └── sparta/page.tsx      # Sparta dashboard (server component)
├── lib/
│   ├── db.ts                # pg Pool, env-aware
│   └── queries.ts           # one loader per Neon table
├── db/
│   └── migrations/
│       └── 0001_initial.sql # all 5 tables, idempotent
├── prompts/
│   └── hex_setup_writeback.md  # paste into Hex's in-app agent
├── scripts/
│   └── migrate.mjs          # tiny runner for db/migrations/*.sql
├── .env.example
├── tailwind.config.ts
├── tsconfig.json
├── next.config.mjs
└── package.json
```
