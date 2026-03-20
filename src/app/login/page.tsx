"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dice6 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);

  // Debounced handle availability check (signup only)
  useEffect(() => {
    if (mode !== "signup" || handle.length < 3) {
      setHandleAvailable(null);
      return;
    }
    setCheckingHandle(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/check-handle?handle=${encodeURIComponent(handle)}`);
      const data = await res.json();
      setHandleAvailable(data.available);
      setCheckingHandle(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [handle, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedHandle = handle.toLowerCase().trim();
    const syntheticEmail = `${normalizedHandle}@dicerollers.local`;

    if (mode === "signup") {
      if (handleAvailable === false) {
        setError("That handle is already taken.");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email: syntheticEmail,
        password,
        options: {
          data: { username: normalizedHandle },
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push("/roll");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });
      if (error) {
        setError("Handle or password is incorrect.");
        setLoading(false);
        return;
      }
      router.push("/roll");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Dice6 className="text-neon-pink w-10 h-10" />
          <Dice6 className="text-text-primary w-10 h-10" />
        </div>
        <h1 className="font-display text-5xl sm:text-6xl neon-text-pink tracking-widest">
          JACKIE LEE&apos;S
        </h1>
        <p className="text-text-secondary text-sm mt-1 tracking-widest uppercase">
          Dice Roll Tracker
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-surface rounded-2xl p-6 border border-surface-2">
        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-surface-2 mb-6">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); setHandleAvailable(null); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "login"
                ? "bg-neon-pink text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "signup"
                ? "bg-neon-pink text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">
              Handle
            </label>
            <div className="relative">
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                placeholder="your_handle"
                className="w-full bg-surface-2 border border-surface-2 rounded-lg px-4 py-3 text-text-primary placeholder-text-secondary focus:outline-none focus:border-neon-pink transition-colors"
              />
              {mode === "signup" && handle.length >= 3 && (
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
            {mode === "signup" && handleAvailable === false && !checkingHandle && (
              <p className="text-neon-pink text-xs mt-1">Handle already taken</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full bg-surface-2 border border-surface-2 rounded-lg px-4 py-3 text-text-primary placeholder-text-secondary focus:outline-none focus:border-neon-pink transition-colors"
            />
          </div>

          {error && (
            <p className="text-neon-pink text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || (mode === "signup" && handleAvailable === false)}
            className="w-full bg-neon-pink text-white font-display text-xl tracking-widest py-3 rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? "ROLL IN" : "JOIN THE BAR"}
          </button>
        </form>
      </div>
    </div>
  );
}
