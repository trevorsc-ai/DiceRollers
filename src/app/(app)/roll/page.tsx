"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import DiePicker from "@/components/DiePicker";
import DoublesConfetti from "@/components/DoublesConfetti";
import MalortCelebration from "@/components/MalortCelebration";
import { CheckCircle, Share2 } from "lucide-react";

interface MenuItem {
  die_color: "red" | "white";
  die_number: number;
  drink_name: string;
  logo_url: string | null;
}

interface DrinkDisplay {
  name: string;
  logo: string | null;
}

export default function RollPage() {
  const supabase = createClient();

  const [redDie, setRedDie] = useState<number | null>(null);
  const [whiteDie, setWhiteDie] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [sharedToFeed, setSharedToFeed] = useState(false);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  const isDoubles = redDie !== null && whiteDie !== null && redDie === whiteDie;
  const isMalort = whiteDie === 6;

  const getMenuItem = useCallback((color: "red" | "white", num: number): DrinkDisplay | null => {
    const item = menu.find((m) => m.die_color === color && m.die_number === num);
    if (!item) return null;
    return { name: item.drink_name, logo: item.logo_url };
  }, [menu]);

  const redDrink = redDie !== null ? getMenuItem("red", redDie) : null;
  const whiteDrink = whiteDie !== null ? getMenuItem("white", whiteDie) : null;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_public")
          .eq("id", user.id)
          .single();
        setIsPublic(profile?.is_public ?? false);
      }

      const { data } = await supabase
        .from("menu_items")
        .select("die_color, die_number, drink_name, logo_url")
        .eq("is_active", true)
        .order("die_number");
      if (data) setMenu(data);
    }
    load();
  }, [supabase]);

  async function handleSave() {
    if (redDie === null || whiteDie === null || !userId) return;
    const redDrinkItem = getMenuItem("red", redDie);
    const whiteDrinkItem = getMenuItem("white", whiteDie);
    if (!redDrinkItem || !whiteDrinkItem) return;

    setSaving(true);
    const { error } = await supabase.from("rolls").insert({
      user_id: userId,
      red_die_number: redDie,
      white_die_number: whiteDie,
      red_drink_name: redDrinkItem.name,
      white_drink_name: whiteDrinkItem.name,
      red_drink_logo: redDrinkItem.logo,
      white_drink_logo: whiteDrinkItem.logo,
    });
    setSaving(false);
    if (!error) setSaved(true);
  }

  function handleReset() {
    setRedDie(null);
    setWhiteDie(null);
    setSaved(false);
    setSharedToFeed(false);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      {/* Animations */}
      {isDoubles && saved && <DoublesConfetti active />}
      {isMalort && saved && <MalortCelebration active />}

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">ROLL</h1>
        <p className="text-text-secondary text-xs mt-1">
          {dateStr} · {timeStr}
        </p>
      </div>

      {/* Dice pickers */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <DiePicker color="red" value={redDie} onChange={setRedDie} />
        <DiePicker color="white" value={whiteDie} onChange={setWhiteDie} />
      </div>

      {/* Drink display */}
      {(redDrink || whiteDrink) && (
        <div className="bg-surface rounded-2xl p-4 mb-6 border border-surface-2 animate-scale-in">
          <p className="text-text-secondary text-xs uppercase tracking-widest text-center mb-3">
            Tonight&apos;s Combo
          </p>
          <div className="flex items-center justify-around">
            {redDrink && (
              <DrinkCard drink={redDrink} dieColor="red" dieNum={redDie!} />
            )}
            {redDrink && whiteDrink && (
              <div className="text-text-secondary text-2xl">+</div>
            )}
            {whiteDrink && (
              <DrinkCard drink={whiteDrink} dieColor="white" dieNum={whiteDie!} />
            )}
          </div>

          {/* Doubles bonus */}
          {isDoubles && (
            <div className="mt-4 pt-4 border-t border-surface-2 text-center">
              <p className="font-display text-xl neon-text-gold tracking-widest animate-pulse-neon">
                🎲 DOUBLES! 🎲
              </p>
              <p className="text-text-primary text-sm mt-1">
                You also get: <span className="text-neon-gold">Old Time Lager</span> + <span className="text-neon-gold">Tullamore Dew shot!</span>
              </p>
            </div>
          )}

          {/* Malort callout */}
          {isMalort && !isDoubles && (
            <div className="mt-4 pt-4 border-t border-surface-2 text-center">
              <p className="font-display text-xl neon-text-green tracking-widest">
                😬 MALORT INCOMING 😬
              </p>
            </div>
          )}
        </div>
      )}

      {/* Save / Saved state */}
      {!saved ? (
        <button
          onClick={handleSave}
          disabled={redDie === null || whiteDie === null || saving}
          className="w-full bg-neon-pink text-white font-display text-2xl tracking-widest py-4 rounded-2xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-30"
        >
          {saving ? "SAVING..." : "SAVE ROLL"}
        </button>
      ) : (
        <div className="space-y-3 animate-scale-in">
          <div className="flex items-center justify-center gap-2 text-neon-green">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Roll saved!</span>
          </div>

          {isPublic && !sharedToFeed && (
            <button
              onClick={() => setSharedToFeed(true)}
              className="w-full flex items-center justify-center gap-2 bg-surface border border-surface-2 hover:border-neon-green text-text-secondary hover:text-neon-green py-3 rounded-2xl transition-colors text-sm tracking-wider"
            >
              <Share2 className="w-4 h-4" />
              SHARE TO FEED
            </button>
          )}
          {sharedToFeed && (
            <p className="text-center text-neon-green text-sm">Shared to feed!</p>
          )}

          <button
            onClick={handleReset}
            className="w-full bg-surface border border-surface-2 text-text-secondary py-3 rounded-2xl transition-colors text-sm tracking-wider hover:text-text-primary"
          >
            ROLL AGAIN
          </button>
        </div>
      )}
    </div>
  );
}

function DrinkCard({ drink, dieColor, dieNum }: {
  drink: { name: string; logo: string | null };
  dieColor: "red" | "white";
  dieNum: number;
}) {
  const isRed = dieColor === "red";
  return (
    <div className="flex flex-col items-center gap-2 flex-1 px-2">
      <div
        className={`w-16 h-16 rounded-xl flex items-center justify-center border-2 ${
          isRed ? "border-neon-pink/40 bg-neon-pink/10" : "border-text-primary/20 bg-text-primary/5"
        }`}
      >
        {drink.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={drink.logo} alt={drink.name} className="w-12 h-12 object-contain rounded-lg" />
        ) : (
          <span className={`font-display text-2xl ${isRed ? "text-neon-pink" : "text-text-primary"}`}>
            {dieNum}
          </span>
        )}
      </div>
      <div className="text-center">
        <p className="text-text-primary text-xs font-medium leading-tight">{drink.name}</p>
        <p className={`text-xs ${isRed ? "text-neon-pink/70" : "text-text-secondary"}`}>
          {isRed ? "Beer" : "Shot"}
        </p>
      </div>
    </div>
  );
}
