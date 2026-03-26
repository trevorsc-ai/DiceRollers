"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, List, Puzzle } from "lucide-react";
import Link from "next/link";

interface UserRow {
  id: string;
  username: string;
  is_admin: boolean;
  is_public: boolean;
  created_at: string;
}

export default function AdminPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

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
        .select("id, username, is_admin, is_public, created_at")
        .order("created_at");

      if (data) setUsers(data);
      setLoading(false);
    }
    load();
  }, [supabase]);

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
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield className="w-6 h-6 text-neon-pink" />
          <h1 className="font-display text-4xl neon-text-pink tracking-widest">ADMIN</h1>
        </div>
        <p className="text-text-secondary text-xs">{users.length} registered users</p>
      </div>

      <div className="space-y-3 mb-6">
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
                  {u.is_public ? " · Public" : " · Private"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {u.is_admin && (
                  <span className="bg-neon-pink/20 border border-neon-pink text-neon-pink text-xs px-2 py-0.5 rounded-full">
                    ADMIN
                  </span>
                )}
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
