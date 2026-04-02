import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/layout/BottomNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if user has accepted the Dice Roll Oath
  const { data: profile } = await supabase
    .from("profiles")
    .select("oath_accepted_at")
    .eq("id", user.id)
    .single();

  if (!profile?.oath_accepted_at) redirect("/oath");

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pb-safe overflow-y-auto">
        {children}
      </main>
      <BottomNav />
      {/* <MickeysPuzzleModal /> */}
    </div>
  );
}
