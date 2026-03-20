---
planStatus:
  planId: plan-handle-only-auth
  title: Handle-Only Authentication
  status: ready-for-development
  planType: feature
  priority: high
  owner: travisscavone
  stakeholders: []
  tags: ["auth", "supabase", "ux"]
  created: "2026-03-19"
  updated: "2026-03-19T00:00:00.000Z"
  progress: 0
---

# Handle-Only Authentication

## Objective

Remove email from signup and login flows. Users authenticate with **handle + password only**. Handles are unique, case-insensitive, and have no character restrictions beyond 3–20 character length limits.

---

## Decisions Made

| Question | Decision |
|---|---|
| Existing admin account | Migrate `double6s` — update auth.users email to `double6s@dicerollers.local` |
| Forgot password | Add optional recovery email field on the Settings page |
| Handle format | No character restrictions (beyond 3–20 length) |
| Case sensitivity | Case-insensitive — handles lowercased on save and login |

---

## Technical Approach: Synthetic Email Mapping

Supabase Auth requires an email. We never expose this to users. Instead:

- **Signup**: user enters `MyHandle` + password → app sends `myhandle@dicerollers.local` to Supabase
- **Login**: user enters `MyHandle` (any case) + password → app lowercases → sends `myhandle@dicerollers.local`
- **Handle uniqueness**: enforced at DB level (`username UNIQUE NOT NULL`) + pre-check API before signup
- **Email confirmation**: must be **disabled** in Supabase dashboard (already should be)

All existing Supabase Auth infrastructure (sessions, cookies, RLS, triggers) remains intact.

---

## Files Changed

### 1. `src/app/login/page.tsx` — Login/Signup UI

**Remove:**
- `email` state variable and input field (both modes)

**Add:**
- `handle` state variable and input field visible in **both** Sign In and Sign Up modes
- Real-time handle availability check on signup (debounced, calls `/api/check-handle`)
- Lowercase normalization before any Supabase call

**Signup flow:**
```ts
const normalizedHandle = handle.toLowerCase().trim();
// pre-check availability
const { error } = await supabase.auth.signUp({
  email: `${normalizedHandle}@dicerollers.local`,
  password,
  options: { data: { username: normalizedHandle } },
});
```

**Login flow:**
```ts
const normalizedHandle = handle.toLowerCase().trim();
const { error } = await supabase.auth.signInWithPassword({
  email: `${normalizedHandle}@dicerollers.local`,
  password,
});
```

**Error message updates:**
- "Invalid login credentials" → "Handle or password is incorrect"
- Remove any email-specific error text

---

### 2. `src/app/api/check-handle/route.ts` — New API Route

GET endpoint, called during signup typing (debounced).

```
GET /api/check-handle?handle=myhandle
→ { available: true }
→ { available: false, reason: "taken" }
→ { available: false, reason: "too-short" | "too-long" }
```

Uses server-side Supabase client to query `profiles.username`. Returns availability status. No auth required (public handles are visible anyway).

---

### 3. `supabase/migrations/003_handle_auth_changes.sql` — DB Migration

Two changes:

**a) Case-insensitive uniqueness** — prevent `Alice` and `alice` from both existing:
```sql
-- Drop old unique constraint, add case-insensitive one
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (lower(username));

-- Update trigger to always lowercase username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    lower(COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**b) Optional recovery email column on profiles:**
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_email TEXT;
```

---

### 4. `src/app/(app)/settings/page.tsx` — Settings Page

Add an **optional recovery email** section:
- Input field for recovery email (currently empty for existing users)
- Save button updates `profiles.recovery_email`
- Display text: "Used only if you need admin help resetting your password. Never used to log in."
- Not required, not validated as an auth email — just stored for reference

---

### 5. `src/types/database.ts` — TypeScript Types

Add `recovery_email: string | null` to the `profiles` Row, Insert, and Update types.

---

## Account Migration Step (Manual — Pre-Deploy)

Before deploying, Travis's `double6s` account must be migrated:

1. In **Supabase Dashboard → Authentication → Users**, find `travis.scavone@protonmail.com`
2. Update email to `double6s@dicerollers.local`
3. After deploy, log in with handle `double6s` + existing password

---

## Out of Scope

- Self-service forgot-password flow (recovery email is stored for admin manual reset only)
- Renaming `username` → `handle` in the DB (cosmetic, unnecessary)
- Any changes to RLS policies, roll data, or other app features

---

## Deployment Checklist

- [ ] Disable email confirmation in Supabase Auth settings (Dashboard → Auth → Providers → Email)
- [ ] Migrate `double6s` auth.users email before going live
- [ ] Run migration `003_handle_auth_changes.sql`
- [ ] Deploy updated login page
- [ ] Test signup with new handle, login, logout, login again
- [ ] Test handle uniqueness (try duplicate handle)
- [ ] Test case-insensitivity (sign up `TestUser`, try login as `testuser`)
