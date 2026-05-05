"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DiePicker from "@/components/DiePicker";
import DoublesConfetti from "@/components/DoublesConfetti";
import MalortCelebration from "@/components/MalortCelebration";
import AchievementModal from "@/components/AchievementModal";
import { CheckCircle, Settings } from "lucide-react";
import type { AchievementInfo } from "@/lib/achievements";

interface MenuItem {
  die_color: string;
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

  // Daily Double
  const [dailyDoubleChoice, setDailyDoubleChoice] = useState<boolean | null>(null);

  // Achievement celebration
  const [newAchievements, setNewAchievements] = useState<AchievementInfo[]>([]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  const isDoubles = redDie !== null && whiteDie !== null && redDie === whiteDie;
  const isMalort = whiteDie === 6;

  const getMenuItem = useCallback(
    (color: string, num: number): DrinkDisplay | null => {
      const item = menu.find((m) => m.die_color === color && m.die_number === num);
      if (!item) return null;
      return { name: item.drink_name, logo: item.logo_url };
    },
    [menu]
  );

  const regularRedDrink = redDie !== null ? getMenuItem("red", redDie) : null;
  const regularWhiteDrink = whiteDie !== null ? getMenuItem("white", whiteDie) : null;

  const dailyDoubleBeer = getMenuItem("daily_double", 1);
  const dailyDoubleShot = getMenuItem("daily_double", 2);

  // The drinks actually shown / saved depend on daily double choice
  const displayRedDrink =
    isDoubles && dailyDoubleChoice === true ? dailyDoubleBeer : regularRedDrink;
  const displayWhiteDrink =
    isDoubles && dailyDoubleChoice === true ? dailyDoubleShot : regularWhiteDrink;

  // Reset daily double choice when dice change
  useEffect(() => {
    setDailyDoubleChoice(null);
  }, [redDie, whiteDie]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
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
    if (isDoubles && dailyDoubleChoice === null) return; // must choose

    const takingDailyDouble = isDoubles && dailyDoubleChoice === true;
    const redDrink = takingDailyDouble ? dailyDoubleBeer : regularRedDrink;
    const whiteDrink = takingDailyDouble ? dailyDoubleShot : regularWhiteDrink;

    if (!redDrink || !whiteDrink) return;

    setSaving(true);
    const res = await fetch("/api/rolls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redDieNumber: redDie,
        whiteDieNumber: whiteDie,
        redDrinkName: redDrink.name,
        whiteDrinkName: whiteDrink.name,
        redDrinkLogo: redDrink.logo,
        whiteDrinkLogo: whiteDrink.logo,
        dailyDouble: takingDailyDouble,
      }),
    });
    setSaving(false);

    if (res.ok) {
      const { newAchievements: earned } = await res.json();
      setSaved(true);
      if (earned && earned.length > 0) {
        // Persist to localStorage so bottom nav can show notification dot
        try {
          const existing = JSON.parse(localStorage.getItem("new_achievements") ?? "[]");
          localStorage.setItem(
            "new_achievements",
            JSON.stringify([...existing, ...earned.map((a: AchievementInfo) => a.id)])
          );
        } catch {
          // ignore
        }
        setNewAchievements(earned);
      }
    }
  }

  function handleReset() {
    setRedDie(null);
    setWhiteDie(null);
    setSaved(false);
    setDailyDoubleChoice(null);
    setNewAchievements([]);
  }

  const canSave =
    redDie !== null &&
    whiteDie !== null &&
    !saving &&
    (!isDoubles || dailyDoubleChoice !== null);

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      {/* Animations */}
      {isDoubles && <DoublesConfetti active />}
      {isMalort && !isDoubles && <MalortCelebration active />}

      {/* Achievement celebration modal */}
      {newAchievements.length > 0 && (
        <AchievementModal
          achievements={newAchievements}
          onClose={() => setNewAchievements([])}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="w-8" />
        <div className="text-center">
          <h1 className="font-display text-4xl neon-text-pink tracking-widest">ROLL</h1>
          <p className="text-text-secondary text-xs mt-1">
            {dateStr} · {timeStr}
          </p>
        </div>
        <Link href="/settings" className="text-text-secondary hover:text-text-primary">
          <Settings className="w-5 h-5" />
        </Link>
      </div>

      {/* Dice pickers */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <DiePicker color="red" value={redDie} onChange={setRedDie} />
        <DiePicker color="white" value={whiteDie} onChange={setWhiteDie} />
      </div>

      {/* Drink display */}
      {(displayRedDrink || displayWhiteDrink) && (
        <div className="bg-surface rounded-2xl p-4 mb-6 border border-surface-2 animate-scale-in">
          <p className="text-text-secondary text-xs uppercase tracking-widest text-center mb-3">
            Tonight&apos;s Combo
          </p>
          <div className="flex items-center justify-around">
            {displayRedDrink && (
              <DrinkCard drink={displayRedDrink} dieColor="red" dieNum={redDie ?? 0} />
            )}
            {displayRedDrink && displayWhiteDrink && (
              <div className="text-text-secondary text-2xl">+</div>
            )}
            {displayWhiteDrink && (
              <DrinkCard drink={displayWhiteDrink} dieColor="white" dieNum={whiteDie ?? 0} />
            )}
          </div>

          {/* Daily Double opt-in — shown when doubles are rolled and not yet saved */}
          {isDoubles && !saved && (
            <div className="mt-4 pt-4 border-t border-surface-2">
              <p className="font-display text-xl neon-text-gold tracking-widest text-center animate-pulse-neon mb-3">
                🎲 DOUBLES! 🎲
              </p>

              {dailyDoubleBeer && dailyDoubleShot && (
                <div className="space-y-2">
                  <p className="text-text-secondary text-xs text-center">
                    Take the Daily Double instead?
                  </p>
                  <p className="text-neon-gold text-xs text-center">
                    {dailyDoubleBeer.name} + {dailyDoubleShot.name}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDailyDoubleChoice(true)}
                      className={`flex-1 py-2.5 rounded-xl font-display text-sm tracking-widest border transition-all ${
                        dailyDoubleChoice === true
                          ? "bg-neon-gold text-background border-neon-gold"
                          : "border-neon-gold/40 text-neon-gold hover:border-neon-gold"
                      }`}
                    >
                      YES — DAILY DOUBLE
                    </button>
                    <button
                      onClick={() => setDailyDoubleChoice(false)}
                      className={`flex-1 py-2.5 rounded-xl font-display text-sm tracking-widest border transition-all ${
                        dailyDoubleChoice === false
                          ? "bg-surface-2 text-text-primary border-surface-2"
                          : "border-surface-2 text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      NO — KEEP IT
                    </button>
                  </div>
                </div>
              )}
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
          disabled={!canSave}
          className="w-full bg-neon-pink text-white font-display text-2xl tracking-widest py-4 rounded-2xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-30"
        >
          {saving ? "SAVING..." : "SAVE ROLL"}
        </button>
      ) : (
        <div className="space-y-3 animate-scale-in">
          <div className="flex items-center justify-center gap-2 text-neon-green">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Roll saved & shared to feed!</span>
          </div>

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

function DrinkCard({
  drink,
  dieColor,
  dieNum,
}: {
  drink: { name: string; logo: string | null };
  dieColor: string;
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
          <img
            src={drink.logo}
            alt={drink.name}
            className="w-12 h-12 object-contain rounded-lg"
          />
        ) : (
          <span
            className={`font-display text-2xl ${isRed ? "text-neon-pink" : "text-text-primary"}`}
          >
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
