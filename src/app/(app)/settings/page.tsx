"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Shield } from "lucide-react";
import Link from "next/link";

interface Profile {
  username: string;
  is_admin: boolean;
  recovery_email: string | null;
}

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  const [newHandle, setNewHandle] = useState("");
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [savingHandle, setSavingHandle] = useState(false);
  const [handleSaved, setHandleSaved] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("username, is_admin, recovery_email")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfile(data);
        setNewHandle(data.username);
        setRecoveryEmail(data.recovery_email ?? "");
      }
    }
    load();
  }, [supabase]);

  // Debounced handle availability check
  useEffect(() => {
    if (!profile || newHandle === profile.username) {
      setHandleAvailable(null);
      return;
    }
    if (newHandle.length < 3) {
      setHandleAvailable(null);
      return;
    }
    setCheckingHandle(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/check-handle?handle=${encodeURIComponent(newHandle)}`);
      const data = await res.json();
      setHandleAvailable(data.available);
      setCheckingHandle(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [newHandle, profile]);

  async function saveHandle() {
    if (!profile) return;
    setSavingHandle(true);
    setHandleError(null);
    const normalized = newHandle.toLowerCase().trim();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingHandle(false); return; }

    // Update profile username
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ username: normalized })
      .eq("id", user.id);

    if (profileError) {
      setHandleError("Failed to update handle. Try again.");
      setSavingHandle(false);
      return;
    }

    // Update auth email to match new synthetic email
    const { error: authError } = await supabase.auth.updateUser({
      email: `${normalized}@dicerollers.local`,
    });

    if (authError) {
      // Roll back profile change
      await supabase.from("profiles").update({ username: profile.username }).eq("id", user.id);
      setHandleError("Failed to update handle. Try again.");
      setSavingHandle(false);
      return;
    }

    setProfile({ ...profile, username: normalized });
    setHandleSaved(true);
    setTimeout(() => setHandleSaved(false), 2000);
    setSavingHandle(false);
  }

  async function saveRecoveryEmail() {
    setSavingEmail(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ recovery_email: recoveryEmail.trim() || null })
        .eq("id", user.id);
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    }
    setSavingEmail(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!profile) return null;

  const handleChanged = newHandle !== profile.username;
  const handleValid = newHandle.length >= 3 && newHandle.length <= 20;
  const canSaveHandle = handleChanged && handleValid && handleAvailable === true && !checkingHandle;

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">SETTINGS</h1>
      </div>

      <div className="space-y-4 max-w-sm mx-auto">
        {/* Handle */}
        <div className="bg-surface rounded-2xl p-4 border border-surface-2">
          <p className="text-text-primary text-sm font-medium mb-0.5">Handle</p>
          <p className="text-text-secondary text-xs mb-3">
            Changing your handle will update how you appear to others.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={newHandle}
                onChange={(e) => { setNewHandle(e.target.value); setHandleError(null); }}
                minLength={3}
                maxLength={20}
                placeholder="your_handle"
                className="w-full bg-surface-2 border border-surface-2 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-neon-pink transition-colors"
              />
              {handleChanged && handleValid && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                  {checkingHandle ? (
                    <span className="text-text-secondary">...</span>
                  ) : handleAvailable === true ? (
                    <span className="text-neon-green">✓</span>
                  ) : handleAvailable === false ? (
                    <span className="text-neon-pink">✗</span>
                  ) : null}
                </span>
              )}
            </div>
            <button
              onClick={saveHandle}
              disabled={!canSaveHandle || savingHandle}
              className="px-3 py-2 bg-neon-pink text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {handleSaved ? "Saved!" : savingHandle ? "..." : "Save"}
            </button>
          </div>
          {handleChanged && handleAvailable === false && !checkingHandle && (
            <p className="text-neon-pink text-xs mt-1">Handle already taken</p>
          )}
          {handleError && (
            <p className="text-neon-pink text-xs mt-1">{handleError}</p>
          )}
        </div>

        {/* Recovery email */}
        <div className="bg-surface rounded-2xl p-4 border border-surface-2">
          <p className="text-text-primary text-sm font-medium mb-0.5">Recovery Email</p>
          <p className="text-text-secondary text-xs mb-3">
            Optional. Only used if you need admin help resetting your password.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 bg-surface-2 border border-surface-2 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-neon-pink transition-colors"
            />
            <button
              onClick={saveRecoveryEmail}
              disabled={savingEmail}
              className="px-3 py-2 bg-neon-pink text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {emailSaved ? "Saved!" : savingEmail ? "..." : "Save"}
            </button>
          </div>
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
