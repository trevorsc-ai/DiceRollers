"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dice6 } from "lucide-react";

export default function OathPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acceptOath() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/accept-oath", { method: "POST" });
    if (!res.ok) {
      setError("Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    router.push("/roll");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Dice6 className="text-neon-pink w-10 h-10" />
          <Dice6 className="text-text-primary w-10 h-10" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl neon-text-pink tracking-widest">
          THE DICE ROLL OATH
        </h1>
      </div>

      {/* Oath Card */}
      <div className="w-full max-w-md bg-surface rounded-2xl p-6 border border-surface-2 space-y-6">
        <p className="text-text-secondary text-sm text-center">
          By tapping &ldquo;I Solemnly Swear,&rdquo; you agree to the following:
        </p>

        <div className="space-y-5">
          <div>
            <h2 className="font-display text-lg text-neon-pink tracking-wider mb-1">
              THE FIRST RULE OF ROLLING DICE
            </h2>
            <p className="text-text-primary text-sm leading-relaxed">
              You do not log fake rolls. Ever.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg text-neon-pink tracking-wider mb-1">
              THE SECOND RULE OF Rolling Dice
            </h2>
            <p className="text-text-primary text-sm leading-relaxed">
              You <span className="font-bold">DO NOT</span> log fake rolls. Ever.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg text-neon-pink tracking-wider mb-1">
              THE THIRD RULE
            </h2>
            <p className="text-text-primary text-sm leading-relaxed">
              If you hear the gong, you cheer on your fellow roller, the moment is real,
              and it better have happened at Jackie Lee&apos;s.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg text-neon-pink tracking-wider mb-1">
              THE FOURTH RULE
            </h2>
            <p className="text-text-primary text-sm leading-relaxed">
              No referees. No instant replay. No VAR. Just trust. This entire operation
              runs on the honor system. If you log a roll, you rolled it.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg text-neon-pink tracking-wider mb-1">
              THE FIFTH RULE
            </h2>
            <p className="text-text-primary text-sm leading-relaxed">
              The leaderboard is sacred. The achievements are earned. The stats are real.
              Falsifying a roll is a crime against the community, the dice, and frankly,
              yourself. The dice gods will know. They will judge you.
            </p>
          </div>
        </div>

        <div className="border-t border-surface-2 pt-5">
          <p className="text-text-secondary text-xs text-center mb-4 italic">
            By proceeding, you swear on your bar tab that you will uphold the sacred integrity of the roll.
          </p>

          {error && (
            <p className="text-neon-pink text-sm text-center mb-3">{error}</p>
          )}

          <button
            onClick={acceptOath}
            disabled={loading}
            className="w-full bg-neon-pink text-white font-display text-xl tracking-widest py-3 rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "..." : "I SOLEMNLY SWEAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
