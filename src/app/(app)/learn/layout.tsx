import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
