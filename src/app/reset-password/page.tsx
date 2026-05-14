"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dice6 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setSessionError("Invalid or expired reset link.");
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setSessionError("This link has expired or is invalid. Please request a new one.");
      } else {
        setSessionReady(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("Failed to update password. Please try again.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/roll"), 2000);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
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

      <div className="w-full max-w-sm bg-surface rounded-2xl p-6 border border-surface-2">
        <h2 className="font-display text-xl tracking-widest text-text-primary mb-4 text-center">
          RESET PASSWORD
        </h2>

        {sessionError ? (
          <p className="text-neon-pink text-sm text-center">{sessionError}</p>
        ) : !sessionReady ? (
          <p className="text-text-secondary text-sm text-center">Verifying link...</p>
        ) : success ? (
          <p className="text-neon-green text-sm text-center">Password updated! Redirecting...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">
                New Password
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
            <div>
              <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              disabled={loading}
              className="w-full bg-neon-pink text-white font-display text-xl tracking-widest py-3 rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "..." : "SET PASSWORD"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
