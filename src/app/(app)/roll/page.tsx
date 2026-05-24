"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import DiePicker from "@/components/DiePicker";
import DoublesConfetti from "@/components/DoublesConfetti";
import MalortCelebration from "@/components/MalortCelebration";
import AchievementModal from "@/components/AchievementModal";
import { DrinkBadge } from "@/components/roll/DrinkBadge";
import { Check, Settings } from "lucide-react";
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

interface SaveRollInput {
  redDieNumber: number;
  whiteDieNumber: number;
  redDrinkName: string;
  whiteDrinkName: string;
  redDrinkLogo: string | null;
  whiteDrinkLogo: string | null;
  dailyDouble: boolean;
}

interface SaveRollResponse {
  rollId: number;
  newAchievements: AchievementInfo[];
}

export default function RollPage() {
  const supabase = createClient();

  const [redDie, setRedDie] = useState<number | null>(null);
  const [whiteDie, setWhiteDie] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [dailyDoubleChoice, setDailyDoubleChoice] = useState<boolean | null>(null);
  const [newAchievements, setNewAchievements] = useState<AchievementInfo[]>([]);

  const { data: menu = [], error: menuError } = useQuery({
    queryKey: ["menuItems", "active"],
    // Menu rarely changes during a session; the admin/menu page invalidates
    // its own key, this one is read-only.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("die_color, die_number, drink_name, logo_url")
        .eq("is_active", true)
        .order("die_number");
      if (error) throw error;
      return (data as MenuItem[]) ?? [];
    },
  });

  const saveRoll = useMutation({
    mutationFn: async (input: SaveRollInput): Promise<SaveRollResponse> => {
      const res = await fetch("/api/rolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: ({ newAchievements: earned }) => {
      setSaved(true);
      if (earned && earned.length > 0) {
        try {
          const existing = JSON.parse(localStorage.getItem("new_achievements") ?? "[]");
          localStorage.setItem(
            "new_achievements",
            JSON.stringify([...existing, ...earned.map((a) => a.id)])
          );
        } catch (err) {
          console.warn("localStorage failed:", err);
        }
        setNewAchievements(earned);
      }
    },
  });
  const saving = saveRoll.isPending;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  }).toUpperCase();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  }).toUpperCase();

  const isDoubles = redDie !== null && whiteDie !== null && redDie === whiteDie;
  const isDouble6s = isDoubles && redDie === 6;
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

  const displayRedDrink =
    isDoubles && dailyDoubleChoice === true ? dailyDoubleBeer : regularRedDrink;
  const displayWhiteDrink =
    isDoubles && dailyDoubleChoice === true ? dailyDoubleShot : regularWhiteDrink;

  useEffect(() => {
    setDailyDoubleChoice(null);
  }, [redDie, whiteDie]);

  function handleSave() {
    if (redDie === null || whiteDie === null) return;
    if (isDoubles && !isDouble6s && dailyDoubleChoice === null) return;

    const takingDailyDouble = isDoubles && !isDouble6s && dailyDoubleChoice === true;
    const redDrink = takingDailyDouble ? dailyDoubleBeer : regularRedDrink;
    const whiteDrink = takingDailyDouble ? dailyDoubleShot : regularWhiteDrink;
    if (!redDrink || !whiteDrink) return;

    saveRoll.mutate({
      redDieNumber: redDie,
      whiteDieNumber: whiteDie,
      redDrinkName: redDrink.name,
      whiteDrinkName: whiteDrink.name,
      redDrinkLogo: redDrink.logo,
      whiteDrinkLogo: whiteDrink.logo,
      dailyDouble: takingDailyDouble,
    });
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
    (!isDoubles || isDouble6s || dailyDoubleChoice !== null);

  return (
    <div className="min-h-screen bg-background">
      {isDoubles && <DoublesConfetti active />}
      {isMalort && !isDoubles && <MalortCelebration active />}
      {newAchievements.length > 0 && (
        <AchievementModal achievements={newAchievements} onClose={() => setNewAchievements([])} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0">
        <div className="w-8" />
        <div className="text-center">
          <h1 className="neon-title font-display text-[38px] tracking-[0.32em] leading-none">ROLL</h1>
          <p className="font-display text-[11px] tracking-[0.14em] text-text-muted mt-1">
            {dateStr} · {timeStr}
          </p>
        </div>
        <Link href="/settings" className="w-8 h-8 bg-surface border border-surface-2 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
          <Settings className="w-[15px] h-[15px]" strokeWidth={1.5} />
        </Link>
      </div>

      {/* Scrollable body */}
      <div className="px-[18px] pb-[84px] flex flex-col gap-3.5">
        {menuError && (
          <div className="bg-surface border border-neon-pink/40 rounded-[14px] p-3 text-center">
            <p className="text-neon-pink text-xs font-medium">Couldn&apos;t load tonight&apos;s menu</p>
            <p className="text-text-secondary text-[11px] mt-0.5">Refresh the page to try again.</p>
          </div>
        )}

        {/* Dice pickers */}
        <div className="grid grid-cols-2 gap-3">
          <DiePicker color="red" value={redDie} onChange={setRedDie} />
          <DiePicker color="white" value={whiteDie} onChange={setWhiteDie} />
        </div>

        {/* Combo card */}
        {(displayRedDrink || displayWhiteDrink) && (
          <div
            className="bg-surface border rounded-[20px] p-[14px_16px]"
            style={{
              borderColor: isDoubles ? "rgba(255,214,0,0.33)" : "#252525",
              animation: "flip-in 0.3s ease-out",
            }}
          >
            <p className="font-display text-[10px] tracking-[0.22em] text-center text-text-muted mb-3">
              TONIGHT&apos;S COMBO
            </p>
            <div className="flex items-center justify-around">
              {displayRedDrink && (
                <DrinkBadge
                  size="lg"
                  color="red"
                  name={displayRedDrink.name}
                  logo={displayRedDrink.logo}
                  dieNum={redDie ?? 0}
                />
              )}
              {displayRedDrink && displayWhiteDrink && (
                <div className="text-[#333] text-[22px] shrink-0">+</div>
              )}
              {displayWhiteDrink && (
                <DrinkBadge
                  size="lg"
                  color="white"
                  name={displayWhiteDrink.name}
                  logo={displayWhiteDrink.logo}
                  dieNum={whiteDie ?? 0}
                />
              )}
            </div>

            {/* Daily Double prompt */}
            {isDoubles && !saved && (
              <div className="mt-4 pt-4 border-t border-surface-2">
                <p className="font-display text-base tracking-[0.20em] text-center mb-3 neon-text-gold">
                  🎲 DOUBLES! 🎲
                </p>
                {isDouble6s ? (
                  <p className="text-text-secondary text-xs text-center">
                    Double 6s means Mickeys + Malort — no Daily Double for you!
                  </p>
                ) : (
                  dailyDoubleBeer && dailyDoubleShot && (
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
                          className={`flex-1 py-2.5 rounded-[18px] font-display text-sm tracking-widest border transition-all ${
                            dailyDoubleChoice === true
                              ? "bg-neon-gold text-background border-neon-gold"
                              : "border-neon-gold/40 text-neon-gold hover:border-neon-gold"
                          }`}
                        >
                          YES — DAILY DOUBLE
                        </button>
                        <button
                          onClick={() => setDailyDoubleChoice(false)}
                          className={`flex-1 py-2.5 rounded-[18px] font-display text-sm tracking-widest border transition-all ${
                            dailyDoubleChoice === false
                              ? "bg-surface-2 text-text-primary border-surface-2"
                              : "border-surface-2 text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          NO — KEEP IT
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Malort callout */}
            {isMalort && !isDoubles && (
              <div className="mt-4 pt-4 border-t border-surface-2 text-center">
                <p className="font-display text-sm tracking-[0.18em] neon-text-green">
                  😬 MALORT INCOMING 😬
                </p>
              </div>
            )}
          </div>
        )}

        {/* Save / Saved */}
        {!saved ? (
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={
              canSave
                ? { boxShadow: "0 0 24px rgba(255,45,85,0.45)" }
                : { background: "#1A0008", borderColor: "#2A0018" }
            }
            className={`w-full py-[18px] rounded-[18px] font-display text-[22px] tracking-[0.28em] border transition-all ${
              canSave
                ? "bg-neon-pink border-neon-pink text-white hover:opacity-90 active:scale-95"
                : "text-[#FF2D5535] cursor-default"
            }`}
          >
            {saving ? "SAVING..." : "SAVE ROLL"}
          </button>
        ) : (
          <div className="space-y-2.5 animate-scale-in">
            <div className="flex items-center justify-center gap-2 neon-text-green">
              <Check className="w-4 h-4" strokeWidth={2.5} />
              <span className="font-display text-[13px] tracking-[0.14em]">ROLL SAVED!</span>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-3.5 bg-surface border border-surface-2 rounded-[18px] font-display text-sm tracking-[0.22em] text-text-secondary hover:text-text-primary transition-colors"
            >
              ROLL AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

