import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side admin gate for every page under `/admin/*`. Each admin page
 * used to repeat the same auth check on mount, racing the UI between a
 * loading spinner and the access-denied screen. Doing it once at the
 * layout level removes that flash and the duplication.
 *
 * The parent `(app)/layout.tsx` already redirects unauthenticated users to
 * /login, so by the time this runs we always have a session.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <AccessDenied />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return <AccessDenied />;

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <Shield className="w-12 h-12 text-neon-pink mx-auto mb-4" />
        <p className="text-text-primary font-display text-2xl">ACCESS DENIED</p>
        <p className="text-text-secondary text-sm mt-2">Admin only</p>
      </div>
    </div>
  );
}
