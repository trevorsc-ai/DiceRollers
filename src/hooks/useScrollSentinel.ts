"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Wires up an IntersectionObserver to call `onIntersect` whenever the
 * referenced sentinel scrolls into view. Pair with a query library's
 * `fetchNextPage()` for infinite scroll.
 *
 * Example:
 *   const sentinelRef = useScrollSentinel(() => {
 *     if (hasNextPage && !isFetchingNextPage) fetchNextPage();
 *   });
 *   return <div ref={sentinelRef} aria-hidden />;
 */
export function useScrollSentinel(
  onIntersect: () => void,
  options: { rootMargin?: string } = {}
) {
  const { rootMargin = "200px 0px" } = options;
  // Keep latest callback in a ref so we don't reattach the observer on
  // every render.
  const callbackRef = useRef(onIntersect);
  callbackRef.current = onIntersect;

  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) callbackRef.current();
        },
        { rootMargin }
      );
      observerRef.current.observe(node);
    },
    [rootMargin]
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return sentinelRef;
}
