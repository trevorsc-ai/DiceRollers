import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { handle } = body as { handle: string };

  if (!handle || handle.trim().length < 3) {
    return NextResponse.json({ status: "no_recovery_email" });
  }

  const normalizedHandle = handle.toLowerCase().trim();
  const adminSupabase = createAdminClient();

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id, recovery_email")
    .eq("username", normalizedHandle)
    .single();

  if (!profile?.recovery_email) {
    return NextResponse.json({ status: "no_recovery_email" });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data: linkData, error: linkError } =
    await adminSupabase.auth.admin.generateLink({
      type: "recovery",
      email: `${normalizedHandle}@dicerollers.local`,
      options: { redirectTo: `${appUrl}/reset-password` },
    });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);

  const { error: emailError } = await resend.emails.send({
    from: "DiceRollers <onboarding@resend.dev>",
    to: profile.recovery_email,
    subject: "Reset your DiceRollers password",
    html: `
      <p>Hey <strong>${normalizedHandle}</strong>,</p>
      <p>You requested a password reset for your DiceRollers account.</p>
      <p>
        <a href="${linkData.properties.action_link}" style="background:#e91e8c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
          Reset Password
        </a>
      </p>
      <p>This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>
    `,
  });

  if (emailError) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "email_sent" });
}
