"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Shield } from "lucide-react";
import Link from "next/link";

interface Profile {
  username: string;
  is_admin: boolean;
}

const SETTINGS_PROFILE_KEY = ["settingsProfile"] as const;

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: SETTINGS_PROFILE_KEY,
    queryFn: async (): Promise<Profile | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("username, is_admin")
        .eq("id", user.id)
        .single();
      return (data as Profile) ?? null;
    },
  });

  // Local form state — initialised from the query once it lands.
  const [newHandle, setNewHandle] = useState("");
  const [handleInitialized, setHandleInitialized] = useState(false);

  useEffect(() => {
    if (profile && !handleInitialized) {
      setNewHandle(profile.username);
      setHandleInitialized(true);
    }
  }, [profile, handleInitialized]);

  // Debounced handle availability check
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
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
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/check-handle?handle=${encodeURIComponent(newHandle)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setHandleAvailable(data.available);
        setCheckingHandle(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCheckingHandle(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [newHandle, profile]);

  const saveHandle = useMutation({
    mutationFn: async (handle: string) => {
      const normalized = handle.toLowerCase().trim();
      const res = await fetch("/api/update-handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: normalized }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error === "handle-taken"
            ? "Handle already taken."
            : "Failed to update handle. Try again."
        );
      }
      return normalized;
    },
    onSuccess: (normalized) => {
      queryClient.setQueryData<Profile | null>(SETTINGS_PROFILE_KEY, (prev) =>
        prev ? { ...prev, username: normalized } : prev
      );
      setNewHandle(normalized);
    },
  });

  // Show "Saved!" briefly after a successful save.
  const [handleSavedFlash, setHandleSavedFlash] = useState(false);
  useEffect(() => {
    if (saveHandle.isSuccess) {
      setHandleSavedFlash(true);
      const t = setTimeout(() => setHandleSavedFlash(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saveHandle.isSuccess, saveHandle.data]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!profile) return null;

  const handleChanged = newHandle !== profile.username;
  const handleValid = newHandle.length >= 3 && newHandle.length <= 20;
  const canSaveHandle = handleChanged && handleValid && handleAvailable === true && !checkingHandle;
  const handleError = saveHandle.error instanceof Error ? saveHandle.error.message : null;

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
                onChange={(e) => { setNewHandle(e.target.value); saveHandle.reset(); }}
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
              onClick={() => saveHandle.mutate(newHandle)}
              disabled={!canSaveHandle || saveHandle.isPending}
              className="px-3 py-2 bg-neon-pink text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {handleSavedFlash ? "Saved!" : saveHandle.isPending ? "..." : "Save"}
            </button>
          </div>
          {handleChanged && handleAvailable === false && !checkingHandle && (
            <p className="text-neon-pink text-xs mt-1">Handle already taken</p>
          )}
          {handleError && <p className="text-neon-pink text-xs mt-1">{handleError}</p>}
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
