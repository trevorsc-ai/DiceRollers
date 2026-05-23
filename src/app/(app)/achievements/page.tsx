import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createQueryClient } from "@/lib/queryClient";
import { achievementsPageQueryKey, fetchAchievementsPage } from "@/lib/queries/achievements";
import AchievementsView from "./AchievementsView";

/**
 * Server component. Resolves the current user and prefetches their
 * achievements page on the server before the HTML is sent. The client
 * mounts <AchievementsView> with an already-hydrated cache, so the user
 * never sees a loading spinner on first paint.
 */
export default async function AchievementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const queryClient = createQueryClient();
  await queryClient.prefetchQuery({
    queryKey: achievementsPageQueryKey(user.id),
    queryFn: () => fetchAchievementsPage(supabase, user.id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AchievementsView userId={user.id} />
    </HydrationBoundary>
  );
}
