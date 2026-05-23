import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createQueryClient } from "@/lib/queryClient";
import {
  DEFAULT_HISTORY_FILTERS,
  fetchHistoryPage,
  historyQueryKey,
  historyTotalQueryKey,
} from "@/lib/queries/rolls";
import HistoryView from "./HistoryView";

/**
 * Server component. Prefetches the unfiltered first page + total count so
 * the initial paint is fully populated. If the user lands with filters
 * already applied (future feature) the client refetches with the new key —
 * that's expected.
 */
export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const queryClient = createQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: historyTotalQueryKey(user.id),
      queryFn: async () => {
        const { count } = await supabase
          .from("rolls")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        return count ?? 0;
      },
    }),
    queryClient.prefetchInfiniteQuery({
      queryKey: historyQueryKey(user.id, DEFAULT_HISTORY_FILTERS),
      initialPageParam: null as string | null,
      queryFn: ({ pageParam }) =>
        fetchHistoryPage(supabase, user.id, DEFAULT_HISTORY_FILTERS, pageParam),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HistoryView userId={user.id} />
    </HydrationBoundary>
  );
}
