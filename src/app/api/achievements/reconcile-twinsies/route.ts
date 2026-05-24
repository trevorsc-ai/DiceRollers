import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  twinEventKey,
  type TwinsiesEvent,
} from "@/lib/twinsies";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface NewTwinModalEntry {
  partners: string[];
  count: number;
}

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Load current twinsies row for this user (if any)
  const { data: existing } = await admin
    .from("user_achievements")
    .select("progress, progress_detail, completed_at, earned_on_roll_id")
    .eq("user_id", user.id)
    .eq("achievement_id", "twinsies")
    .maybeSingle();

  const existingDetail =
    (existing?.progress_detail as { credited_events?: TwinsiesEvent[] } | null) ?? {};
  const credited: TwinsiesEvent[] = existingDetail.credited_events ?? [];
  const creditedKeys = new Set(credited.map((e) => e.key));

  // Find all twin events this user is part of (one row per unique combo+date).
  // For each, gather distinct partner usernames and the earliest qualifying roll.
  const { data: myRolls } = await admin
    .from("rolls")
    .select("id, roll_date, red_die_number, white_die_number, roll_time")
    .eq("user_id", user.id)
    .order("roll_time", { ascending: true });

  if (!myRolls || myRolls.length === 0) {
    return NextResponse.json({ newEvents: [] });
  }

  // Group my rolls by (date, red, white) keeping the earliest one
  const myByKey = new Map<
    string,
    { roll_id: number; roll_time: string; roll_date: string; red: number; white: number }
  >();
  for (const r of myRolls) {
    const key = twinEventKey(r.roll_date, r.red_die_number, r.white_die_number);
    if (!myByKey.has(key)) {
      myByKey.set(key, {
        roll_id: r.id as number,
        roll_time: r.roll_time as string,
        roll_date: r.roll_date as string,
        red: r.red_die_number as number,
        white: r.white_die_number as number,
      });
    }
  }

  // For each of my distinct (date, red, white) tuples, check if any other user
  // rolled the same combo on the same date.
  type Candidate = {
    key: string;
    roll_id: number;
    roll_time: string;
    roll_date: string;
    red: number;
    white: number;
    partners: string[];
  };
  const candidates: Candidate[] = [];

  const myEntries = Array.from(myByKey.entries());
  for (const [key, mine] of myEntries) {
    if (creditedKeys.has(key)) continue;

    const { data: partnerRolls } = await admin
      .from("rolls")
      .select("user_id, profiles!inner(username)")
      .eq("roll_date", mine.roll_date)
      .eq("red_die_number", mine.red)
      .eq("white_die_number", mine.white)
      .neq("user_id", user.id);

    type ProfileRow = { username: string | null };
    type PartnerRow = { user_id: string; profiles: ProfileRow | ProfileRow[] | null };
    const partners = Array.from(
      new Set(
        ((partnerRolls ?? []) as unknown as PartnerRow[])
          .map((r) => {
            const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
            return p?.username ?? null;
          })
          .filter((u): u is string => typeof u === "string")
      )
    ).sort();

    if (partners.length > 0) {
      candidates.push({ key, ...mine, partners });
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ newEvents: [] });
  }

  // Sort by roll_time so counts increment in chronological order
  candidates.sort((a, b) => (a.roll_time < b.roll_time ? -1 : 1));

  const events: TwinsiesEvent[] = [...credited];
  const newEvents: NewTwinModalEntry[] = [];

  for (const c of candidates) {
    events.push({
      key: c.key,
      roll_date: c.roll_date,
      red: c.red,
      white: c.white,
      partners: c.partners,
      roll_id: c.roll_id,
    });
    newEvents.push({ partners: c.partners, count: events.length });
  }

  const now = new Date().toISOString();

  if (existing) {
    await admin
      .from("user_achievements")
      .update({
        progress: events.length,
        progress_detail: { credited_events: events },
        completed_at: existing.completed_at ?? now,
        earned_on_roll_id: existing.earned_on_roll_id ?? candidates[0].roll_id,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .eq("achievement_id", "twinsies");
  } else {
    await admin.from("user_achievements").insert({
      user_id: user.id,
      achievement_id: "twinsies",
      progress: events.length,
      progress_detail: { credited_events: events },
      completed_at: now,
      earned_on_roll_id: candidates[0].roll_id,
      updated_at: now,
    });
  }

  return NextResponse.json({ newEvents });
}
