# DiceRollers — Deployment Standard

> Claude owns the end-to-end deploy process. You only need to paste secret values when asked.

---

## Overview: 5 Phases

Every change — code, migration, or both — follows the same five phases:

```
PREFLIGHT → DEVELOP → PRE-PR → MIGRATE + MERGE → POST-DEPLOY
```

Run `scripts/deploy/ship.sh` to execute the full flow, or call each phase script individually.

---

## Phase 1: Preflight

**Script:** `scripts/deploy/preflight.sh`  
**When:** Always run at the start of a session before touching any code.

Steps:
1. `git pull origin main` — sync local to remote
2. `supabase migration list` — compare Local vs Remote columns
3. If drift detected (Remote has versions with no local file): run `supabase db pull`, generate the local migration file, commit it on its own branch before continuing

**Goal:** Catch drift before any work begins. This script is read-only — safe to run anytime.

---

## Phase 2: Develop

Standard feature work:

1. Branch off main: `git checkout -b feat/<name>` (or `fix/`, `chore/`)
2. Make code changes, write SQL migrations in `supabase/migrations/NNN_description.sql`
3. After any schema change: `supabase gen types typescript --linked > src/types/database.ts`
4. Commit frequently; push WIP even if incomplete: `git push origin <branch>`
   - Use `wip: <message>` prefix for incomplete commits
   - **This is mandatory** — no local-only work; any device must be able to resume

---

## Phase 3: Pre-PR Gates

**Script:** `scripts/deploy/prepush.sh`  
All four must pass before pushing the final commit:

```bash
supabase gen types typescript --linked > src/types/database.ts  # if schema changed
npx tsc --noEmit                                                  # type check
npx next lint                                                     # lint
npx next build                                                    # prod build
```

Do not open the PR until all four pass.

---

## Phase 4: Migrate + Merge

**Script:** `scripts/deploy/migrate.sh` then `scripts/deploy/merge.sh`

### 4a. Apply migration (if any SQL changed)

```bash
supabase db push --linked
```

This runs **before** merging code to main. The DB schema must be ready before the code that depends on it goes live.

**Destructive migrations** (DROP, RENAME): allowed any time. If it's a busy evening, flag it once and let you decide — then proceed.

### 4b. Push branch + open PR

```bash
git push origin <branch>
gh pr create --title "<title>" --body "<body>" --base main
```

### 4c. Wait for preview gate

Poll Vercel until the preview deployment is READY, then:

```bash
curl -sI <preview-url>  # expect 200 or 3xx
curl -s <preview-url>/api/health  # expect { ok: true, db: "up" }
```

Only merge after both pass.

### 4d. Squash-merge

```bash
gh pr merge <number> --squash --delete-branch
```

Vercel auto-deploys main. No manual `vercel --prod` needed.

---

## Phase 5: Post-Deploy Verification

**Script:** `scripts/deploy/postdeploy.sh`

1. Poll `vercel deployments list` until the production deployment is READY (≤5 min typical)
2. Curl production health:

```bash
curl -sI https://www.diceroll.today           # expect 200 or 3xx
curl -s https://www.diceroll.today/api/health # expect { ok: true, db: "up" }
# Note: bare diceroll.today redirects (307) to www.diceroll.today
```

**If either fails:** Surface the error with full output. Do NOT auto-rollback. Wait for you to decide next steps.

---

## Drift Recovery Runbook

When `supabase migration list` shows Remote versions with no local file:

1. Run `supabase db pull` to capture the live schema
2. It generates a new migration file — review it, then rename it to the next sequential number
3. Commit the file on a `chore/capture-migration-NNN` branch
4. PR + merge that branch first, before any feature work
5. Then resume the feature branch from a clean base

When local files exist that Remote hasn't seen:
- If the schema change IS present on remote: `supabase migration repair --status applied <version>`
- If it is NOT present: run `supabase db push --linked` to apply it

Version collisions (duplicate NNN prefix):
- Rename the local file to the next available number (e.g., `021_foo.sql` → `067_foo.sql`)
- Update any references in code or comments

---

## Env Var Workflow

When a change needs a new environment variable:

1. Claude adds the variable to `.env.example` (documenting the name, never the value)
2. Claude runs `vercel env add <VAR_NAME>` for both Preview and Production environments
3. Claude prompts you for the secret value — paste it once, it goes to both environments
4. `.env.local` is never committed (it's in `.gitignore`)

---

## Branch Naming

| Type | Pattern |
|---|---|
| Feature | `feat/<short-description>` |
| Bug fix | `fix/<short-description>` |
| Migration only | `chore/migration-<NNN>-<description>` |
| WIP capture | same branch, `wip:` prefix on commit message |
| Drift capture | `chore/capture-migration-<NNN>` |

---

## What Claude Does vs. What You Do

| Action | Owner |
|---|---|
| All git operations (branch, commit, push, merge) | Claude |
| All Supabase CLI operations (migration list, db push, gen types) | Claude |
| All Vercel CLI operations (deploy check, env add) | Claude |
| Opening and merging PRs via `gh` | Claude |
| Paste secret env var values when prompted | **You** |
| Decide whether to rollback after a failure | **You** |
| Apply changes in Supabase Studio (out-of-band) | **You** (Claude captures the drift next session) |

---

## Timing Guidance

No hard deploy freezes. For destructive migrations (DROP, RENAME) or large refactors, if it looks like a busy evening, Claude will flag it once. You decide — then Claude proceeds immediately either way.

---

## Related

- `scripts/deploy/ship.sh` — full orchestrator
- `scripts/deploy/preflight.sh` — read-only session start check
- `scripts/deploy/prepush.sh` — pre-PR gates
- `scripts/deploy/migrate.sh` — apply migrations to remote
- `scripts/deploy/merge.sh` — preview gate + squash merge
- `scripts/deploy/postdeploy.sh` — production verification
- `src/app/api/health/route.ts` — health endpoint (used by postdeploy)
