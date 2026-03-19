"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Filter } from "lucide-react";

interface Roll {
  id: number;
  roll_date: string;
  roll_time: string;
  red_die_number: number;
  white_die_number: number;
  red_drink_name: string;
  white_drink_name: string;
  red_drink_logo: string | null;
  white_drink_logo: string | null;
  is_doubles: boolean;
}

export default function HistoryPage() {
  const supabase = createClient();
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [doublesOnly, setDoublesOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("rolls")
        .select("*")
        .eq("user_id", user.id)
        .order("roll_time", { ascending: false });

      if (data) setRolls(data);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = rolls.filter((r) => {
    if (doublesOnly && !r.is_doubles) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.red_drink_name.toLowerCase().includes(q) && !r.white_drink_name.toLowerCase().includes(q)) return false;
    }
    if (dateFrom && r.roll_date < dateFrom) return false;
    if (dateTo && r.roll_date > dateTo) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">HISTORY</h1>
        <p className="text-text-secondary text-xs mt-1">{rolls.length} total rolls</p>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drinks..."
            className="w-full bg-surface border border-surface-2 rounded-xl pl-10 pr-4 py-2.5 text-text-primary placeholder-text-secondary focus:outline-none focus:border-neon-pink transition-colors text-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setDoublesOnly(!doublesOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              doublesOnly
                ? "bg-neon-gold/20 border-neon-gold text-neon-gold"
                : "border-surface-2 text-text-secondary hover:text-text-primary"
            }`}
          >
            <Filter className="w-3 h-3" />
            Doubles Only
          </button>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-surface border border-surface-2 rounded-lg px-2 py-1.5 text-text-secondary text-xs focus:outline-none focus:border-neon-pink [color-scheme:dark]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-surface border border-surface-2 rounded-lg px-2 py-1.5 text-text-secondary text-xs focus:outline-none focus:border-neon-pink [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Roll list */}
      {loading ? (
        <div className="text-center text-text-secondary py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-text-secondary py-12">
          <p className="text-4xl mb-3">🎲</p>
          <p>No rolls yet. Get rolling!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((roll) => (
            <RollCard key={roll.id} roll={roll} />
          ))}
        </div>
      )}
    </div>
  );
}

function RollCard({ roll }: { roll: Roll }) {
  const date = new Date(roll.roll_time);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  return (
    <div className={`bg-surface rounded-2xl p-4 border transition-colors ${
      roll.is_doubles ? "border-neon-gold/40" : "border-surface-2"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-text-primary text-sm font-medium">{dateStr}</p>
          <p className="text-text-secondary text-xs">{timeStr}</p>
        </div>
        {roll.is_doubles && (
          <span className="bg-neon-gold/20 border border-neon-gold text-neon-gold text-xs px-2 py-0.5 rounded-full font-display tracking-wider">
            DOUBLES!
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <DrinkItem
          name={roll.red_drink_name}
          logo={roll.red_drink_logo}
          dieNum={roll.red_die_number}
          color="red"
        />
        <span className="text-text-secondary text-lg">+</span>
        <DrinkItem
          name={roll.white_drink_name}
          logo={roll.white_drink_logo}
          dieNum={roll.white_die_number}
          color="white"
        />
      </div>
    </div>
  );
}

function DrinkItem({ name, logo, dieNum, color }: {
  name: string;
  logo: string | null;
  dieNum: number;
  color: "red" | "white";
}) {
  const isRed = color === "red";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
        isRed ? "bg-neon-pink/10 border border-neon-pink/30" : "bg-surface-2 border border-surface-2"
      }`}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="w-6 h-6 object-contain" />
        ) : (
          <span className={`font-display text-sm ${isRed ? "text-neon-pink" : "text-text-primary"}`}>
            {dieNum}
          </span>
        )}
      </div>
      <div>
        <p className="text-text-primary text-xs font-medium leading-tight">{name}</p>
        <p className={`text-xs ${isRed ? "text-neon-pink/70" : "text-text-secondary"}`}>
          {isRed ? `🔴 ${dieNum}` : `⚪ ${dieNum}`}
        </p>
      </div>
    </div>
  );
}
