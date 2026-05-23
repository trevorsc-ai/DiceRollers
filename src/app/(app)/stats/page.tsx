import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createQueryClient } from "@/lib/queryClient";
import { personalStatsQueryKey, fetchPersonalStats } from "@/lib/queries/stats";
import StatsView from "./StatsView";

/**
 * Server component. Prefetches the user's *personal* stats so the default
 * tab renders without a spinner. The "ALL ROLLERS" tab still fetches
 * client-side when the user switches to it — we don't want to pay the
 * three-RPC cost on every stats page hit if the user doesn't ask for it.
 */
export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const queryClient = createQueryClient();
  await queryClient.prefetchQuery({
    queryKey: personalStatsQueryKey(user.id),
    queryFn: () => fetchPersonalStats(supabase, user.id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StatsView userId={user.id} />
    </HydrationBoundary>
  );
}
