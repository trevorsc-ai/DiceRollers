"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  username: string;
  total_rolls: number;
  doubles_count: number;
  doubles_pct: number;
  most_rolled_beer: string | null;
  most_rolled_shot: string | null;
  achievements: { emoji: string; name: string }[];
}

interface UserProfileModalProps {
  username: string;
  onClose: () => void;
}

const COLOR_MAP: Record<string, string> = {
  pink: "text-neon-pink",
  gold: "text-neon-gold",
  green: "text-neon-green",
};

function StatTile({
  label,
  value,
  color,
  small,
}: {
  label: string;
  value: string;
  color: "pink" | "gold" | "green";
  small?: boolean;
}) {
  return (
    <div className="bg-surface-2 rounded-2xl p-3 text-center">
      <p className="text-text-secondary text-xs tracking-widest mb-1">{label}</p>
      <p className={`font-display ${small ? "text-sm" : "text-2xl"} ${COLOR_MAP[color]} leading-tight`}>
        {value}
      </p>
    </div>
  );
}

export default function UserProfileModal({ username, onClose }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data } = await supabase.rpc("get_user_profile_stats", {
        p_username: username,
      });
      setProfile(data as UserProfile | null);
      setLoading(false);
    }
    load();
  }, [username]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-surface-2 rounded-3xl p-6 w-full max-w-sm animate-scale-in shadow-2xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h2 className="font-display text-xl neon-text-pink tracking-widest">
            {username.toUpperCase()}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-text-secondary text-sm tracking-widest">
            LOADING...
          </div>
        ) : !profile ? (
          <div className="py-10 text-center text-text-secondary text-sm">
            No data available.
          </div>
        ) : (
          <>
            {/* Top stats row */}
            <div className="grid grid-cols-3 gap-2 mb-3 shrink-0">
              <StatTile label="ROLLS" value={profile.total_rolls.toString()} color="pink" />
              <StatTile label="DOUBLES" value={profile.doubles_count.toString()} color="gold" />
              <StatTile label="DBL %" value={`${profile.doubles_pct}%`} color="green" />
            </div>

            {/* Beer + Shot row */}
            {(profile.most_rolled_beer || profile.most_rolled_shot) && (
              <div className="grid grid-cols-2 gap-2 mb-5 shrink-0">
                {profile.most_rolled_beer && (
                  <StatTile
                    label="🍺 TOP BEER"
                    value={profile.most_rolled_beer}
                    color="pink"
                    small
                  />
                )}
                {profile.most_rolled_shot && (
                  <StatTile
                    label="🥃 TOP SHOT"
                    value={profile.most_rolled_shot}
                    color="gold"
                    small
                  />
                )}
              </div>
            )}

            {/* Achievements */}
            {profile.achievements.length > 0 && (
              <div className="flex flex-col flex-1 min-h-0">
                <p className="text-text-secondary text-xs tracking-widest font-display mb-3 shrink-0">
                  ACHIEVEMENTS
                </p>
                <div className="overflow-y-auto flex-1 flex flex-wrap gap-1.5 content-start">
                  {profile.achievements.map((a) => (
                    <div
                      key={a.name}
                      className="flex items-center gap-1 bg-surface-2 rounded-full px-2.5 py-1"
                    >
                      <span className="text-sm leading-none">{a.emoji}</span>
                      <span className="text-text-primary text-xs">{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
