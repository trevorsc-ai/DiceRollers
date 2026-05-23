"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createQueryClient } from "@/lib/queryClient";

/**
 * App-wide client providers. Holds the singleton QueryClient inside useState
 * so HMR/StrictMode don't recreate it on every render. The Devtools panel
 * tree-shakes out of production builds.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV !== "production" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
