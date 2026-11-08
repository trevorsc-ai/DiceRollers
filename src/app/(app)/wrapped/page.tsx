import Link from "next/link";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createQueryClient } from "@/lib/queryClient";
import {
  fetchAppFlag,
  fetchWrapped,
  fetchWrappedGlobal,
  wrappedGlobalQueryKey,
  wrappedQueryKey,
} from "@/lib/queries/stats";
import { wrappedYear } from "@/lib/wrapped";
import WrappedView from "./WrappedView";

/**
 * Server component. Wrapped is hidden until an admin flips `wrapped_live`
 * on /admin. Admins can always open it (shown as a preview) so the deck can
 * be checked against real data before launch.
 */
export default async function WrappedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [live, { data: profile }] = await Promise.all([
    // fetchAppFlag logs its own error; a failed read keeps Wrapped hidden.
    fetchAppFlag(supabase, "wrapped_live").catch(() => false),
    supabase.from("profiles").select("is_admin").eq("id", user.id).single(),
  ]);
  const isAdmin = profile?.is_admin === true;
  const year = wrappedYear();

  if (!live && !isAdmin) return <ComingSoon year={year} />;

  const queryClient = createQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: wrappedQueryKey(user.id, year),
      queryFn: () => fetchWrapped(supabase, user.id, year),
    }),
    queryClient.prefetchQuery({
      queryKey: wrappedGlobalQueryKey(year),
      queryFn: () => fetchWrappedGlobal(supabase, year),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WrappedView userId={user.id} year={year} isPreview={!live} />
    </HydrationBoundary>
  );
}

function ComingSoon({ year }: { year: number }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl mb-4">🎁</p>
      <h1 className="neon-title font-display text-[32px] tracking-[0.2em] leading-tight">WRAPPED {year}</h1>
      <p className="text-text-secondary text-sm mt-3">Drops in early December. Keep rolling, it all counts.</p>
      <Link
        href="/stats"
        className="mt-8 font-display text-[10px] tracking-[0.2em] text-text-secondary border border-surface-2 rounded-lg px-3 py-2 hover:text-text-primary"
      >
        ← BACK TO STATS
      </Link>
    </div>
  );
}
