import { QueryClient } from "@tanstack/react-query";

/**
 * Centralised QueryClient factory. Used in two places:
 *   1. The Providers component (browser-long-lived singleton).
 *   2. Server components prefetching into a fresh client per request.
 *
 * Server-side we *always* want a new client (no cross-request sharing of
 * authenticated data). Client-side we want exactly one across the app so
 * caches survive navigation. The pattern below makes both call sites obvious.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Most data in this app is mildly dynamic — give every key a 30s
        // grace window where it's considered fresh and `useQuery` won't
        // refetch on mount/focus. Override per-query for the chatty stuff
        // (feed) and the static stuff (achievements catalog).
        staleTime: 30_000,
        // Keep results in memory for 5 min after unmount so back-button
        // navigation feels instant.
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
