"use client";

import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import UserProfileModal from "@/components/UserProfileModal";
import { Dice6 } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { useDailyDoubleLogos } from "@/hooks/useDailyDoubleLogos";
import { useScrollSentinel } from "@/hooks/useScrollSentinel";
import { RollCard } from "@/components/roll/RollCard";
import { fetchFeedPage, type FeedRoll, type RollsPage } from "@/lib/queries/rolls";

export default function FeedPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const dailyDoubleLogo = useDailyDoubleLogos();

  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data: myUserId = null, isLoading: authLoading } = useQuery({
    queryKey: ["currentUser"],
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
  });

  // Include myUserId in the key so the `likedByMe` flag rebuilds per signed-in
  // user (and so the cache doesn't bleed between sessions).
  const feedQueryKey = ["feed", myUserId] as const;

  const {
    data,
    isLoading,
    isFetchingNextPage: loadingMore,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: feedQueryKey,
    enabled: !authLoading,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchFeedPage(supabase, myUserId, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 10_000,
  });

  const loading = authLoading || isLoading;

  const rolls: FeedRoll[] = data?.pages.flatMap((p) => p.items) ?? [];

  const sentinelRef = useScrollSentinel(() => {
    if (hasNextPage && !loadingMore) fetchNextPage();
  });

  type ToggleLikeVars = { rollId: number; likedByMe: boolean };
  const toggleLike = useMutation<void, Error, ToggleLikeVars, { previous: InfiniteData<RollsPage<FeedRoll>> | undefined }>({
    mutationFn: async ({ rollId, likedByMe }) => {
      if (!myUserId) throw new Error("Not signed in");
      if (likedByMe) {
        await supabase.from("roll_likes").delete().eq("roll_id", rollId).eq("user_id", myUserId);
      } else {
        await supabase.from("roll_likes").insert({ roll_id: rollId, user_id: myUserId });
      }
    },
    // Optimistically flip the like in the cache; rolled back automatically on
    // error via the previous snapshot we return from onMutate.
    onMutate: async ({ rollId, likedByMe }) => {
      await queryClient.cancelQueries({ queryKey: feedQueryKey });
      const previous = queryClient.getQueryData<InfiniteData<RollsPage<FeedRoll>>>(feedQueryKey);
      queryClient.setQueryData<InfiniteData<RollsPage<FeedRoll>>>(feedQueryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((r) =>
              r.id === rollId
                ? {
                    ...r,
                    likedByMe: !likedByMe,
                    likeCount: likedByMe ? r.likeCount - 1 : r.likeCount + 1,
                  }
                : r
            ),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(feedQueryKey, ctx.previous);
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0">
        <div className="w-8" />
        <div className="text-center">
          <h1 className="neon-title font-display text-[38px] tracking-[0.32em] leading-none">FEED</h1>
          <p className="font-display text-[11px] tracking-[0.14em] text-text-muted mt-1">
            WHAT&apos;S ROLLING AT JACKIE LEE&apos;S
          </p>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-[18px] pb-[84px]">
        {loading ? (
          <div className="text-center text-text-secondary py-12">Loading...</div>
        ) : rolls.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <p className="text-5xl mb-4">🎲</p>
            <p>No public rolls yet.</p>
            <p className="text-sm mt-2">Make your profile public in Settings to appear here!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rolls.map((roll) => (
              <FeedCard
                key={roll.id}
                roll={roll}
                onToggleLike={(rollId, likedByMe) => toggleLike.mutate({ rollId, likedByMe })}
                onUserClick={setSelectedUser}
                dailyDoubleLogo={dailyDoubleLogo}
              />
            ))}
            <div ref={sentinelRef} className="h-1" aria-hidden />
            {loadingMore && (
              <div className="text-center text-text-secondary py-4 font-display text-[11px] tracking-[0.18em]">
                LOADING MORE…
              </div>
            )}
            {!hasNextPage && !loadingMore && rolls.length > 0 && (
              <div className="text-center text-text-muted py-6 font-display text-[10px] tracking-[0.22em]">
                · END OF THE LINE ·
              </div>
            )}
          </div>
        )}
      </div>

      {selectedUser && (
        <UserProfileModal username={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}

function FeedCard({
  roll,
  onToggleLike,
  onUserClick,
  dailyDoubleLogo,
}: {
  roll: FeedRoll;
  onToggleLike: (id: number, likedByMe: boolean) => void;
  onUserClick: (username: string) => void;
  dailyDoubleLogo: ReturnType<typeof useDailyDoubleLogos>;
}) {
  const [bouncing, setBouncing] = useState(false);

  function handleLike() {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 400);
    onToggleLike(roll.id, roll.likedByMe);
  }

  const timeAgo = formatRelativeTime(roll.roll_time);
  const timestamp = new Date(roll.roll_time).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });

  return (
    <RollCard
      roll={roll}
      dailyDoubleLogo={dailyDoubleLogo}
      header={
        <div>
          <button
            onClick={() => onUserClick(roll.username)}
            className="text-text-primary text-[13px] font-semibold hover:text-neon-pink transition-colors"
          >
            {roll.username}
          </button>
          <p className="font-display text-[10px] tracking-[0.08em] text-text-muted mt-0.5">
            {timeAgo} · {timestamp}
          </p>
        </div>
      }
      footer={
        <div className="flex items-center gap-1.5 pt-2 mt-2.5 border-t border-surface-2">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 transition-all"
            style={{
              color: roll.likedByMe ? "#FF2D55" : "#555",
              transform: bouncing ? "scale(1.25)" : "scale(1)",
              transition: "transform 0.18s, color 0.15s",
            }}
          >
            <Dice6 className="w-4 h-4" strokeWidth={roll.likedByMe ? 2.5 : 1.5} />
            <span className="font-display text-[11px]">{roll.likeCount}</span>
          </button>
        </div>
      }
    />
  );
}
