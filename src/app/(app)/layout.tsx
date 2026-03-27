import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/layout/BottomNav";
import MickeysPuzzleModal from "@/components/MickeysPuzzleModal";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
