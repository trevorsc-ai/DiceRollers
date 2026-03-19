"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Shield } from "lucide-react";
import Link from "next/link";

interface Profile {
  username: string;
  is_public: boolean;
  is_admin: boolean;
}

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("username, is_public, is_admin")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    }
    load();
  }, [supabase]);

  async function togglePublic() {
    if (!profile) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ is_public: !profile.is_public })
        .eq("id", user.id);
      setProfile({ ...profile, is_public: !profile.is_public });
    }
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">SETTINGS</h1>
      </div>

      <div className="space-y-4 max-w-sm mx-auto">
        {/* Profile */}
        <div className="bg-surface rounded-2xl p-4 border border-surface-2">
          <p className="text-text-secondary text-xs uppercase tracking-widest mb-1">Username</p>
          <p className="text-text-primary font-semibold">{profile.username}</p>
        </div>

        {/* Public toggle */}
        <div className="bg-surface rounded-2xl p-4 border border-surface-2 flex items-center justify-between">
          <div>
            <p className="text-text-primary text-sm font-medium">Public Profile</p>
            <p className="text-text-secondary text-xs mt-0.5">Show your rolls in the social feed</p>
          </div>
          <button
            onClick={togglePublic}
            disabled={saving}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              profile.is_public ? "bg-neon-green" : "bg-surface-2"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                profile.is_public ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Admin panel link */}
        {profile.is_admin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 bg-surface rounded-2xl p-4 border border-neon-pink/30 hover:border-neon-pink transition-colors"
          >
            <Shield className="w-5 h-5 text-neon-pink" />
            <span className="text-text-primary text-sm font-medium">Admin Panel</span>
          </Link>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full bg-surface rounded-2xl p-4 border border-surface-2 hover:border-neon-pink/40 transition-colors text-left"
        >
          <LogOut className="w-5 h-5 text-text-secondary" />
          <span className="text-text-secondary text-sm">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
