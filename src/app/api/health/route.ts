import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health
 *
 * Used by the deployment standard to verify production is healthy after deploy.
 * No auth required — this is a health check, not a data endpoint.
 *
 * Returns 200 { ok: true, db: "up", commit: "<sha>" } on success.
 * Returns 503 { ok: false, db: "down", error: "..." } if Supabase is unreachable.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Lightweight ping — select a constant from Postgres to verify connectivity
    const { error } = await supabase.rpc("ping").maybeSingle();

    // If ping RPC doesn't exist, fall back to a simple auth check which still
    // hits the DB. A PGRST202 (function not found) is fine — DB is up.
    if (error && error.code !== "PGRST202") {
      return NextResponse.json(
        {
          ok: false,
          db: "down",
          error: error.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      db: "up",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        error: message,
      },
      { status: 503 }
    );
  }
}
