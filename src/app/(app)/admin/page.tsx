"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Shield, List, TrendingUp } from "lucide-react";
import Link from "next/link";

interface UserRow {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
}

const ADMIN_USERS_KEY = ["adminUsers"] as const;

export default function AdminPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Admin gating happens server-side in /admin/layout.tsx — anyone reaching
  // this page is an admin.
  const { data: users = [], isLoading } = useQuery({
    queryKey: ADMIN_USERS_KEY,
    staleTime: 30_000,
    queryFn: async (): Promise<UserRow[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, is_admin, created_at")
        .order("created_at");
      return (data as UserRow[]) ?? [];
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, currentValue }: { userId: string; currentValue: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_admin: !currentValue })
        .eq("id", userId);
      if (error) throw error;
      return { userId, newValue: !currentValue };
    },
    // Optimistic update — the row flips instantly; if the request fails we
    // restore the previous list.
    onMutate: async ({ userId, currentValue }) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_USERS_KEY });
      const previous = queryClient.getQueryData<UserRow[]>(ADMIN_USERS_KEY);
      queryClient.setQueryData<UserRow[]>(ADMIN_USERS_KEY, (prev) =>
        (prev ?? []).map((u) => (u.id === userId ? { ...u, is_admin: !currentValue } : u))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ADMIN_USERS_KEY, ctx.previous);
    },
  });

  const [resetState, setResetState] = useState<{
    userId: string | null;
    newPassword: string;
    error: string | null;
    success: boolean;
  }>({ userId: null, newPassword: "", error: null, success: false });

  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      return data;
    },
    onSuccess: () => {
      setResetState((s) => ({ ...s, success: true, error: null }));
      setTimeout(() => setResetState({ userId: null, newPassword: "", error: null, success: false }), 1500);
    },
    onError: (err: Error) => {
      setResetState((s) => ({ ...s, error: err.message }));
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      {/* Reset Password Modal */}
      {resetState.userId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl p-6 border border-surface-2 w-full max-w-sm">
            <h2 className="font-display text-xl text-text-primary tracking-widest mb-1">RESET PASSWORD</h2>
            <p className="text-text-secondary text-xs mb-4">
              for <span className="text-text-primary">{users.find((u) => u.id === resetState.userId)?.username}</span>
            </p>
            <input
              type="password"
              value={resetState.newPassword}
              onChange={(e) => setResetState((s) => ({ ...s, newPassword: e.target.value, error: null }))}
              placeholder="New password (min 6 chars)"
              minLength={6}
              className="w-full bg-surface-2 border border-surface-2 rounded-lg px-4 py-3 text-text-primary placeholder-text-secondary focus:outline-none focus:border-neon-pink transition-colors mb-3"
            />
            {resetState.error && <p className="text-neon-pink text-xs mb-3">{resetState.error}</p>}
            {resetState.success && <p className="text-neon-green text-xs mb-3">Password updated!</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setResetState({ userId: null, newPassword: "", error: null, success: false })}
                className="flex-1 py-2 rounded-lg border border-surface-2 text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (resetState.userId && resetState.newPassword.length >= 6) {
                    resetPassword.mutate({ userId: resetState.userId, newPassword: resetState.newPassword });
                  }
                }}
                disabled={resetPassword.isPending || resetState.newPassword.length < 6}
                className="flex-1 py-2 rounded-lg bg-neon-pink text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
              >
                {resetPassword.isPending ? "..." : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield className="w-6 h-6 text-neon-pink" />
          <h1 className="font-display text-4xl neon-text-pink tracking-widest">ADMIN</h1>
        </div>
        <p className="text-text-secondary text-xs">{users.length} registered users</p>
      </div>

      <div className="space-y-3 mb-6">
        <Link
          href="/admin/users"
          className="flex items-center gap-3 bg-surface rounded-2xl p-4 border border-surface-2 hover:border-neon-green/40 transition-colors"
        >
          <TrendingUp className="w-5 h-5 text-neon-green" />
          <div>
            <p className="text-text-primary font-medium">User Dashboard</p>
            <p className="text-text-secondary text-xs">Active users, signups, and growth stats</p>
          </div>
        </Link>
        <Link
          href="/admin/menu"
          className="flex items-center gap-3 bg-surface rounded-2xl p-4 border border-surface-2 hover:border-neon-pink/40 transition-colors"
        >
          <List className="w-5 h-5 text-neon-pink" />
          <div>
            <p className="text-text-primary font-medium">Manage Menu</p>
            <p className="text-text-secondary text-xs">Edit drink names and logos</p>
          </div>
        </Link>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-surface rounded-2xl p-4 border border-surface-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary font-medium">{u.username}</p>
                <p className="text-text-secondary text-xs mt-0.5">
                  Joined {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {u.is_admin && (
                  <span className="bg-neon-pink/20 border border-neon-pink text-neon-pink text-xs px-2 py-0.5 rounded-full">
                    ADMIN
                  </span>
                )}
                <button
                  onClick={() => setResetState({ userId: u.id, newPassword: "", error: null, success: false })}
                  className="px-3 py-1 rounded-lg text-xs border border-surface-2 text-text-secondary hover:border-neon-gold/40 hover:text-neon-gold transition-colors"
                >
                  Reset PW
                </button>
                <button
                  onClick={() => toggleAdmin.mutate({ userId: u.id, currentValue: u.is_admin })}
                  disabled={toggleAdmin.isPending}
                  className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                    u.is_admin
                      ? "border-neon-pink/40 text-neon-pink hover:bg-neon-pink/10"
                      : "border-surface-2 text-text-secondary hover:border-neon-pink/40 hover:text-neon-pink"
                  }`}
                >
                  {u.is_admin ? "Revoke Admin" : "Make Admin"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
