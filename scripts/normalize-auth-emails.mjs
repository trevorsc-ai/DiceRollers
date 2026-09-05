/**
 * normalize-auth-emails.mjs
 *
 * Audits auth.users for any email address that isn't the synthetic
 * <username>@dicerollers.local form, and rewrites it to match the account's
 * handle. Supabase Auth requires an email on every account, so the address
 * can't be removed — but it can be made to carry no personal information.
 *
 * Usage:
 *   node --env-file=.env.local scripts/normalize-auth-emails.mjs           # report only
 *   node --env-file=.env.local scripts/normalize-auth-emails.mjs --apply   # rewrite
 *
 * Dry run by default. Read the report before running with --apply.
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const apply = process.argv.includes("--apply");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL_DOMAIN = "dicerollers.local";

// ── Fetch ────────────────────────────────────────────────────────────────────

/** Pages through the admin user list — listUsers caps out at 1000 per page. */
async function listAllAuthUsers() {
  const all = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed on page ${page}: ${error.message}`);
    all.push(...data.users);
    if (data.users.length < 1000) return all;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const users = await listAllAuthUsers();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username");
  if (profilesError) {
    throw new Error(`Failed to load profiles: ${profilesError.message}`);
  }

  const handleById = new Map(profiles.map((p) => [p.id, p.username]));

  const mismatched = [];
  const orphaned = [];

  for (const user of users) {
    const handle = handleById.get(user.id);
    if (!handle) {
      orphaned.push(user);
      continue;
    }
    const expected = `${handle.toLowerCase()}@${EMAIL_DOMAIN}`;
    if ((user.email ?? "").toLowerCase() !== expected) {
      mismatched.push({ id: user.id, handle, current: user.email, expected });
    }
  }

  console.log(`Scanned ${users.length} auth users.`);

  if (orphaned.length > 0) {
    console.log(`\n${orphaned.length} auth user(s) with no matching profile — skipped:`);
    for (const u of orphaned) console.log(`  ${u.id}  ${u.email}`);
  }

  if (mismatched.length === 0) {
    console.log("\nEvery auth email already matches its handle. Nothing to do.");
    return;
  }

  console.log(`\n${mismatched.length} auth email(s) not in synthetic form:`);
  for (const m of mismatched) {
    console.log(`  ${m.handle}: ${m.current} → ${m.expected}`);
  }

  if (!apply) {
    console.log("\nDry run — nothing was changed. Re-run with --apply to rewrite these.");
    return;
  }

  console.log("\nApplying...");
  let updated = 0;
  for (const m of mismatched) {
    const { error } = await supabase.auth.admin.updateUserById(m.id, {
      email: m.expected,
      email_confirm: true,
    });
    if (error) {
      console.error(`  FAILED ${m.handle} (${m.id}): ${error.message}`);
      continue;
    }
    updated++;
    console.log(`  ok ${m.handle} → ${m.expected}`);
  }

  console.log(`\nDone. ${updated}/${mismatched.length} updated.`);
  if (updated < mismatched.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
