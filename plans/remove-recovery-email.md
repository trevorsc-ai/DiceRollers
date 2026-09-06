---
planStatus:
  planId: plan-remove-recovery-email
  title: Remove Recovery Email & Email PII
  status: in-development
  planType: chore
  priority: high
  owner: travisscavone
  stakeholders: []
  tags: ["auth", "privacy", "supabase"]
  created: "2026-09-05"
  updated: "2026-09-05T00:00:00.000Z"
  progress: 0
---

# Remove Recovery Email & Email PII

## Objective

Strip every real email address out of the app and the database. Nobody's personal
contact information should be stored anywhere in DiceRollers. Password recovery
stops being an email-mediated process and becomes a social one: the forgot-password
panel tells you to go find a regular.

---

## What "email PII" means here

There are two distinct things, and only one of them is personal information:

The first is `profiles.recovery_email`, added by migration 003 and surfaced as an
optional field on the Settings page. This is a genuine, user-supplied personal email
address, and it is the thing this change exists to delete.

The second is `auth.users.email`. Supabase Auth requires an email on every account
and there is no way to opt out of that, so the app fabricates one from the handle:
signing up as `MyHandle` sends `myhandle@dicerollers.local` to Supabase. That
synthetic address carries no personal information — it is the handle, which is
already public throughout the app, with a fixed suffix. It stays. The risk is that
any account created before the handle-only auth switch may still be carrying a real
address in that column, so this change audits and overwrites those.

---

## Decisions Made

| Question | Decision |
|---|---|
| `profiles.recovery_email` | Dropped outright. No backup, no export — the point is that the values stop existing. |
| Synthetic `@dicerollers.local` auth emails | Kept. Required by Supabase Auth, derived from the public handle, not PII. |
| Legacy real emails in `auth.users` | Audited and overwritten with the synthetic form via a one-off script. |
| Forgot-password copy | "Find the regulars rolling a lot of dice, they can help you out" |
| Admin reset-password flow | Unchanged — an admin still resets a password by handle from the admin panel. |

---

## Files Changed

### 1. `supabase/migrations/071_remove_recovery_email.sql` — Drop the column

```sql
ALTER TABLE public.profiles DROP COLUMN IF EXISTS recovery_email;
```

Destructive and irreversible: every stored recovery address is gone the moment this
runs. That is the intent. Per the deployment standard this is applied to prod
**before** the code that no longer references the column is merged.

### 2. `src/types/database.ts` — Regenerated types

`recovery_email` comes out of the `profiles` Row, Insert, and Update shapes. In
practice this is regenerated with `supabase gen types typescript --linked` after the
migration lands, but the field is removed by hand first so `tsc` gates the app code.

### 3. `src/app/(app)/settings/page.tsx` — Remove the Recovery Email section

The whole card comes out, along with everything that fed it: the `recovery_email`
field on the local `Profile` interface, the column in the profile `select`, the
`recoveryEmail` / `recoveryEmailInitialized` state, the initialisation effect branch,
the `saveRecoveryEmail` mutation, and the `emailSavedFlash` effect. What's left on
the page is the handle editor, the admin-panel link, and sign out.

### 4. `src/app/login/page.tsx` — New forgot-password copy

The "Forgot password?" toggle stays; the panel it opens loses both the admin
instruction and the recovery-email instruction, and becomes the single line:

> Find the regulars rolling a lot of dice, they can help you out.

### 5. `scripts/normalize-auth-emails.mjs` — One-off audit + cleanup

Follows the existing `recalculate-achievements.mjs` convention (service-role client,
run via `node --env-file=.env.local`). Lists every `auth.users` account whose email
is not `<username>@dicerollers.local`, and rewrites it to match the profile's handle.

```bash
npm run normalize-auth-emails             # dry run, report only
npm run normalize-auth-emails -- --apply  # rewrite
```

Dry run by default so the report can be read before anything changes.

---

## Out of Scope

- The admin password-reset flow (`/api/admin/reset-password`) — it identifies users
  by handle already and needs no change.
- Removing the synthetic email from Supabase Auth — not possible; Auth requires it.
- Any self-service password reset. There isn't one and this change doesn't add one.
- Renaming or restructuring anything else on `profiles`.

---

## Deployment Checklist

- [ ] Run `scripts/normalize-auth-emails.mjs` (dry run) and read the report
- [ ] Run it with `--apply` to overwrite any real addresses found
- [ ] Pre-PR gates: `npx tsc --noEmit`, `npx next lint`, `npx next build`
- [ ] `supabase db push --linked` to drop `recovery_email` in prod
- [ ] Regenerate `src/types/database.ts` from the live schema
- [ ] Merge code to main
- [ ] Verify: Settings shows no email field, forgot-password panel shows the new copy
