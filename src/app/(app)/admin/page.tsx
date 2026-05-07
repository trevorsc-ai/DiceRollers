"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, List, Puzzle, TrendingUp } from "lucide-react";
import Link from "next/link";

interface UserRow {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
}

interface ResetState {
  userId: string | null;
  newPassword: string;
  loading: boolean;
  error: string | null;
  success: boolean;
}

export default function AdminPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetState, setResetState] = useState<ResetState>({
    userId: null,
    newPassword: "",
    loading: false,
    error: null,
    success: false,
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);

      const { data } = await supabase
        .from("profiles")
        .select("id, username, is_admin, created_at")
        .order("created_at");

      if (data) setUsers(data);
      setLoading(false);
    }
    load();
  }, [supabase]);

  function openReset(userId: string) {
    setResetState({ userId, newPassword: "", loading: false, error: null, success: false });
  }

  function closeReset() {
    setResetState({ userId: null, newPassword: "", loading: false, error: null, success: false });
  }

  async function submitReset() {
    if (!resetState.userId || resetState.newPassword.length < 6) return;
    setResetState((s) => ({ ...s, loading: true, error: null }));
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetState.userId, newPassword: resetState.newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResetState((s) => ({ ...s, loading: false, error: data.error ?? "Failed" }));
    } else {
      setResetState((s) => ({ ...s, loading: false, success: true }));
      setTimeout(closeReset, 1500);
    }
  }

  async function toggleAdmin(userId: string, currentValue: boolean) {
    await supabase
      .from("profiles")
      .update({ is_admin: !currentValue })
      .eq("id", userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_admin: !currentValue } : u))
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-text-secondary">Loading...</p>
    </div>
  );

  if (isAdmin === false) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <Shield className="w-12 h-12 text-neon-pink mx-auto mb-4" />
        <p className="text-text-primary font-display text-2xl">ACCESS DENIED</p>
        <p className="text-text-secondary text-sm mt-2">Admin only</p>
      </div>
    </div>
  );

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
            {resetState.error && (
              <p className="text-neon-pink text-xs mb-3">{resetState.error}</p>
            )}
            {resetState.success && (
              <p className="text-neon-green text-xs mb-3">Password updated!</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={closeReset}
                className="flex-1 py-2 rounded-lg border border-surface-2 text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReset}
                disabled={resetState.loading || resetState.newPassword.length < 6}
                className="flex-1 py-2 rounded-lg bg-neon-pink text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
              >
                {resetState.loading ? "..." : "Reset"}
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
        <Link
          href="/admin/puzzles"
          className="flex items-center gap-3 bg-surface rounded-2xl p-4 border border-surface-2 hover:border-neon-gold/40 transition-colors"
        >
          <Puzzle className="w-5 h-5 text-neon-gold" />
          <div>
            <p className="text-text-primary font-medium">Manage Puzzles</p>
            <p className="text-text-secondary text-xs">Edit Mickey&apos;s daily emoji riddles</p>
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
                  onClick={() => openReset(u.id)}
                  className="px-3 py-1 rounded-lg text-xs border border-surface-2 text-text-secondary hover:border-neon-gold/40 hover:text-neon-gold transition-colors"
                >
                  Reset PW
                </button>
                <button
                  onClick={() => toggleAdmin(u.id, u.is_admin)}
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
