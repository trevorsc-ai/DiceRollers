import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { createQueryClient } from "@/lib/queryClient";
import { ADMIN_DASHBOARD_KEY, fetchAdminDashboard } from "@/lib/queries/admin";
import AdminUsersView from "./AdminUsersView";

/**
 * Server component. The admin gate runs at /admin/layout.tsx so by the time
 * this renders we're confirmed admin. Prefetch the dashboard RPC so the
 * dense charts page paints fully populated.
 */
export default async function AdminUsersPage() {
  const supabase = await createClient();

  const queryClient = createQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ADMIN_DASHBOARD_KEY,
    queryFn: () => fetchAdminDashboard(supabase),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminUsersView />
    </HydrationBoundary>
  );
}
