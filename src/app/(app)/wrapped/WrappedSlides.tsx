"use client";

import type { ReactNode } from "react";
import { DrinkBadge } from "@/components/roll/DrinkBadge";
import { DoublesBadge } from "@/components/roll/DoublesBadge";
import { AchievementPills } from "@/components/roll/GoldPill";
import { VerticalBarChart } from "@/components/VerticalBarChart";
import { formatShortDate, getNeonGlow } from "@/lib/format";
import {
  EXPECTED_ROLLS,
  MONTHS_SHORT,
  P_COMBO,
  P_DOUBLES,
  P_FACE,
  SUPERLATIVE_MIN_ROLLS,
  WEEKDAYS,
  argMax,
  argMin,
  binomialZ,
  dieVerdict,
  expectedTwinsies,
  formatHourRange,
  formatNightMinutes,
  formatP,
  formatSigma,
  normalCdf,
  oneInN,
  pickPersona,
  round1,
  topPercent,
  type CollectionRace,
  type DieVerdict,
  type Superlative,
  type WrappedCombo,
  type WrappedGlobal,
  type WrappedPersonal,
} from "@/lib/wrapped";

export interface Slide {
  key: string;
  /** Accent color for the background glow and progress bar. */
  accent: string;
  content: ReactNode;
}

const PINK = "#FF2D55";
const GOLD = "#FFD600";
const GREEN = "#00FF88";
const PURPLE = "#AA66FF";
const ORANGE = "#FF9966";
const WHITE = "#F5F5F5";

// ─── Building blocks ─────────────────────────────────────────

function Kicker({ children, color = "#999" }: { children: ReactNode; color?: string }) {
  return (
    <p className="font-display text-[11px] tracking-[0.28em] mb-3" style={{ color }}>
      {children}
    </p>
  );
}

function Big({ children, color, size = 72 }: { children: ReactNode; color: string; size?: number }) {
  return (
    <p
      className="font-display leading-none my-2"
      style={{ color, fontSize: size, textShadow: getNeonGlow(color) }}
    >
      {children}
    </p>
  );
}

function Line({ children }: { children: ReactNode }) {
  return <p className="text-text-primary text-[17px] leading-snug mt-3">{children}</p>;
}

function Sub({ children }: { children: ReactNode }) {
  return <p className="text-text-secondary text-[13px] leading-snug mt-2">{children}</p>;
}

function Hi({ children, color = GOLD }: { children: ReactNode; color?: string }) {
  return <span style={{ color }}>{children}</span>;
}

function ComboPair({ combo }: { combo: WrappedCombo }) {
  return (
    <div className="flex items-start justify-center gap-2 my-4 max-w-xs mx-auto">
      <DrinkBadge
        name={combo.red_name ?? `Red ${combo.red}`}
        logo={combo.red_logo}
        dieNum={combo.red}
        color="red"
        size="lg"
      />
      <span className="font-display text-text-secondary text-2xl mt-4">+</span>
      <DrinkBadge
        name={combo.white_name ?? `White ${combo.white}`}
        logo={combo.white_logo}
        dieNum={combo.white}
        color="white"
        size="lg"
      />
    </div>
  );
}

function StatRow({ label, value, color = WHITE }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-surface-2 last:border-0">
      <span className="text-text-secondary text-[13px]">{label}</span>
      <span className="font-display text-[15px] text-right" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function Card({ children, color = "#252525" }: { children: ReactNode; color?: string }) {
  return (
    <div className="bg-surface/80 rounded-2xl border p-4 mt-4 text-left" style={{ borderColor: color }}>
      {children}
    </div>
  );
}

function FaceChart({ freq, color, title }: { freq: number[]; color: string; title: string }) {
  return (
    <div className="mt-3">
      <p className="font-display text-[9px] tracking-[0.22em] text-text-secondary mb-1 text-left">{title}</p>
      <VerticalBarChart data={freq.map((count, i) => ({ label: `${i + 1}`, count }))} color={color} height={70} />
    </div>
  );
}

function VerdictLine({ die, v }: { die: string; v: DieVerdict }) {
  const color = v.p < 0.01 ? PINK : v.p < 0.05 ? GOLD : GREEN;
  return (
    <p className="text-text-primary text-[15px] mt-2">
      {die}: <Hi color={color}>{v.label} {v.emoji}</Hi>{" "}
      <span className="text-text-secondary text-[12px]">({formatP(v.p)})</span>
    </p>
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

function weekdayOf(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

function comboName(c: { red_name: string | null; white_name: string | null }) {
  return `${c.red_name ?? "?"} + ${c.white_name ?? "?"}`;
}

/** "about 1 in 120" with a sane ceiling. */
function oddsText(z: number): string {
  const n = oneInN(z);
  return n > 10_000 ? "less than 1 in 10,000" : `about 1 in ${n.toLocaleString()}`;
}

function RaceRow({
  label,
  race,
  total,
  expected,
  year,
}: {
  label: string;
  race: CollectionRace;
  total: number;
  expected: number;
  year: number;
}) {
  const doneYear = race.done_date ? Number(race.done_date.slice(0, 4)) : null;
  let value: ReactNode;
  if (race.done_at != null && doneYear === year) {
    const faster = race.done_at <= expected;
    value = (
      <>
        <Hi color={faster ? GREEN : ORANGE}>{race.done_at} rolls</Hi>
        <span className="block text-[10px] text-text-secondary tracking-wider">AVG ROLLER: {expected}</span>
      </>
    );
  } else if (race.done_at != null) {
    value = <Hi color={GREEN}>Done in {doneYear}</Hi>;
  } else {
    value = (
      <>
        {race.seen}/{total}
        {race.missing && race.missing.length > 0 && race.missing.length <= 3 && (
          <span className="block text-[10px] text-text-secondary tracking-wider">
            NEED {race.missing.map((f) => `${f}-${f}`).join(", ")}
          </span>
        )}
      </>
    );
  }
  return <StatRow label={label} value={value} />;
}

function DualMonthBars({ a, b, colorA, colorB }: { a: number[]; b: number[]; colorA: string; colorB: string }) {
  const max = Math.max(...a, ...b, 1);
  const barAreaH = 64;
  return (
    <div className="flex items-end gap-1 mt-3">
      {MONTHS_SHORT.map((label, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end gap-[2px]" style={{ height: barAreaH }}>
            {[
              { v: a[i], c: colorA },
              { v: b[i], c: colorB },
            ].map((bar, j) => (
              <div
                key={j}
                className="flex-1"
                style={{
                  height: Math.max((bar.v / max) * barAreaH, 2),
                  background: bar.c,
                  boxShadow: `0 0 6px ${bar.c}80`,
                  borderRadius: "2px 2px 0 0",
                  transformOrigin: "bottom",
                  animation: `grow-bar 0.5s ${i * 0.04}s ease-out both`,
                }}
              />
            ))}
          </div>
          <span className="font-display text-[9px] text-text-secondary">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Deck ────────────────────────────────────────────────────

export interface BuildSlidesInput {
  personal: WrappedPersonal;
  global: WrappedGlobal;
  superlatives: Superlative[];
  userId: string;
  year: number;
}

export function buildSlides({ personal: p, global: g, superlatives, userId, year }: BuildSlidesInput): Slide[] {
  const slides: Slide[] = [];
  const n = p.total_rolls;
  const add = (key: string, accent: string, content: ReactNode) => slides.push({ key, accent, content });

  // 1. Intro
  add(
    "intro",
    PINK,
    <>
      <Kicker color={PINK}>DICEROLLERS WRAPPED</Kicker>
      <Big color={PINK} size={96}>
        {year}
      </Big>
      <Line>@{p.username}</Line>
      <Sub>
        {n > 0
          ? "Let's see what the dice had to say about you."
          : `You didn't roll in ${year}. Here's what you missed.`}
      </Sub>
      <p className="font-display text-[10px] tracking-[0.25em] text-text-muted mt-10">TAP TO CONTINUE →</p>
    </>
  );

  if (n > 0) {
    // 2. Year in rolls
    add(
      "year",
      PINK,
      <>
        <Kicker>YOUR YEAR IN ROLLS</Kicker>
        <Big color={PINK}>{n.toLocaleString()}</Big>
        <Kicker>ROLLS</Kicker>
        <Line>
          <Hi>{plural(n * 2, "drink")}</Hi>. <Hi>{plural(p.nights, "night")}</Hi> of rolling dice.
        </Line>
        {p.rollers > 1 && (
          <Sub>That puts you in the top {topPercent(p.rollers_ahead, p.rollers)}% of rollers.</Sub>
        )}
      </>
    );

    // 3. Signature combo
    const sig = p.signature_combo;
    if (sig && (sig.count ?? 0) >= 2) {
      add(
        "signature",
        GOLD,
        <>
          <Kicker color={GOLD}>YOUR USUAL</Kicker>
          <ComboPair combo={sig} />
          <Line>
            You rolled it <Hi>{plural(sig.count ?? 0, "time")}</Hi>.
          </Line>
          <Sub>
            Any one combo is a 1-in-64 shot, so fair dice expected {round1(n * P_COMBO)}.
          </Sub>
        </>
      );
    }

    // 4. Lucky number
    const faces = p.red_freq.map((r, i) => r + p.white_freq[i]);
    const lucky = argMax(faces);
    const unlucky = argMin(faces);
    add(
      "lucky-number",
      GREEN,
      <>
        <Kicker color={GREEN}>YOUR LUCKY NUMBER</Kicker>
        <Big color={GREEN} size={120}>
          {lucky + 1}
        </Big>
        <Line>
          It came up <Hi>{plural(faces[lucky], "time")}</Hi> across both dice.
        </Line>
        <Sub>
          Least favorite: {unlucky + 1}, just {plural(faces[unlucky], "time")}.
        </Sub>
        <VerticalBarChart
          data={faces.map((count, i) => ({ label: `${i + 1}`, count }))}
          color={GREEN}
          height={80}
        />
      </>
    );

    // 5. Luck index
    const luckZ = binomialZ(p.doubles, n, P_DOUBLES);
    const pct = Math.round(normalCdf(luckZ) * 100);
    add(
      "luck",
      GOLD,
      <>
        <Kicker color={GOLD}>LUCK INDEX</Kicker>
        <Big color={GOLD}>{p.doubles}</Big>
        <Kicker>DOUBLES</Kicker>
        <Line>
          A fair die expected about <Hi>{round1(n * P_DOUBLES)}</Hi>. You&apos;re{" "}
          <Hi color={luckZ >= 0 ? GREEN : PINK}>{formatSigma(luckZ)}</Hi> {luckZ >= 0 ? "lucky" : "unlucky"}.
        </Line>
        <Sub>
          {luckZ >= 0
            ? `Luckier than ${pct}% of fair-dice universes.`
            : `Unluckier than ${100 - pct}% of fair-dice universes.`}
        </Sub>
      </>
    );

    // 6. Is your die rigged?
    if (n >= 16) {
      const rv = dieVerdict(p.red_freq);
      const wv = dieVerdict(p.white_freq);
      const worst = wv.p < rv.p ? { die: "white", freq: p.white_freq } : { die: "red", freq: p.red_freq };
      const fav = argMax(worst.freq) + 1;
      add(
        "rigged",
        PURPLE,
        <>
          <Kicker color={PURPLE}>IS YOUR DIE RIGGED?</Kicker>
          <VerdictLine die="Red die" v={rv} />
          <VerdictLine die="White die" v={wv} />
          {Math.min(rv.p, wv.p) < 0.05 && (
            <Sub>
              Your {worst.die} die <em>really</em> likes {fav}...
            </Sub>
          )}
          <FaceChart freq={p.red_freq} color={PINK} title="● RED DIE" />
          <FaceChart freq={p.white_freq} color={WHITE} title="○ WHITE DIE" />
        </>
      );
    }

    // 7. Malört Magnet
    if (p.malort > 0) {
      const mz = binomialZ(p.malort, n, P_FACE);
      add(
        "malort",
        ORANGE,
        <>
          <Kicker color={ORANGE}>MALÖRT MAGNET</Kicker>
          <Big color={ORANGE}>{p.malort}</Big>
          <Line>
            Malörts this year. Fair dice say <Hi>{round1(n * P_FACE)}</Hi>.
          </Line>
          <Sub>
            {mz >= 1.5
              ? `Odds of getting that unlucky: ${oddsText(mz)}. The Malört chose you.`
              : mz <= -1.5
                ? "The Malört gods spared you. Don't get comfortable."
                : "Right on schedule. Grimace accordingly."}
          </Sub>
        </>
      );
    }

    // 8. Collection race vs the odds
    add(
      "collections",
      GREEN,
      <>
        <Kicker color={GREEN}>COLLECTION RACE VS. THE ODDS</Kicker>
        <Card>
          <RaceRow
            label="🌎 Around the World"
            race={p.around_the_world}
            total={64}
            expected={EXPECTED_ROLLS.aroundTheWorld}
            year={year}
          />
          <RaceRow
            label="🎟️ Punch Card"
            race={p.punch_card}
            total={16}
            expected={EXPECTED_ROLLS.punchCard}
            year={year}
          />
          <RaceRow
            label="😈 Double Trouble"
            race={p.double_trouble}
            total={8}
            expected={EXPECTED_ROLLS.doubleTrouble}
            year={year}
          />
        </Card>
        <Sub>Averages are how many rolls a typical roller needs with fair dice.</Sub>
      </>
    );

    // 9. The combo that ghosted you
    if (p.combos_seen >= 64) {
      add(
        "ghosted",
        GREEN,
        <>
          <Kicker color={GREEN}>THE FULL SET</Kicker>
          <Big color={GREEN}>64/64</Big>
          <Line>You saw every single combo this year. Nothing ghosted you.</Line>
        </>
      );
    } else if (p.ghosted_combo) {
      add(
        "ghosted",
        PURPLE,
        <>
          <Kicker color={PURPLE}>THE COMBO THAT GHOSTED YOU</Kicker>
          <Line>
            You saw <Hi>{p.combos_seen} of 64</Hi> combos this year. The one that got away:
          </Line>
          <ComboPair combo={p.ghosted_combo} />
          <Sub>
            The bar rolled it {plural(p.ghosted_combo.count ?? 0, "time")}. You never hit it once.
          </Sub>
        </>
      );
    }

    // 10. Roll-o-clock
    if (p.clock.median_min != null && p.earliest_roll && p.latest_roll) {
      const topDay = WEEKDAYS[argMax(p.dow_nights)];
      add(
        "clock",
        PURPLE,
        <>
          <Kicker color={PURPLE}>YOUR ROLL-O-CLOCK</Kicker>
          <Big color={PURPLE} size={56}>
            {formatNightMinutes(p.clock.median_min)}
          </Big>
          <Kicker>MEDIAN ROLL</Kicker>
          <Line>
            Earliest: <Hi>{formatNightMinutes(p.earliest_roll.night_min)}</Hi> on a {weekdayOf(p.earliest_roll.date)}.
            Latest: <Hi>{formatNightMinutes(p.latest_roll.night_min)}</Hi>.
          </Line>
          <Sub>Your night is {topDay}.</Sub>
          <VerticalBarChart
            data={p.dow_nights.map((count, i) => ({ label: "SMTWTFS"[i], count }))}
            color={PURPLE}
            height={80}
          />
        </>
      );
    }

    // 11. Streaks
    if (p.longest_streak || p.longest_drought) {
      const s = p.longest_streak;
      const d = p.longest_drought;
      add(
        "streaks",
        PINK,
        <>
          <Kicker color={PINK}>STREAKS & DROUGHTS</Kicker>
          {s && s.nights >= 2 && (
            <>
              <Big color={PINK}>{s.nights}</Big>
              <Line>
                nights straight, {formatShortDate(s.start)}–{formatShortDate(s.end)}.
              </Line>
            </>
          )}
          {d && d.days >= 7 && (
            <Card>
              <p className="text-text-primary text-[15px]">
                Longest drought: <Hi>{d.days} days</Hi> ({formatShortDate(d.from)} → {formatShortDate(d.to)}).
              </p>
              {d.comeback && (
                <Sub>
                  Your comeback roll: {comboName(d.comeback)}. Welcome back.
                </Sub>
              )}
            </Card>
          )}
        </>
      );
    }

    // 12. Drinking soulmate
    if (p.twin_partner || p.night_partner) {
      add(
        "soulmate",
        PINK,
        <>
          <Kicker color={PINK}>YOUR DRINKING SOULMATE</Kicker>
          {p.twin_partner ? (
            <>
              <Big color={PINK} size={44}>
                @{p.twin_partner.username}
              </Big>
              <Line>
                You rolled the exact same combo on the same night{" "}
                <Hi>{plural(p.twin_partner.events, "time")}</Hi>. 👯
              </Line>
            </>
          ) : (
            p.night_partner && (
              <Big color={PINK} size={44}>
                @{p.night_partner.username}
              </Big>
            )
          )}
          {p.night_partner && (
            <Sub>
              {p.twin_partner && p.night_partner.username !== p.twin_partner.username
                ? `Your most frequent bar buddy was @${p.night_partner.username}: ${plural(p.night_partner.nights, "shared night")}.`
                : `You shared ${plural(p.night_partner.nights, "night")} at the bar.`}
            </Sub>
          )}
        </>
      );
    }

    // 13. Fan favorite
    if (p.likes_received > 0 || p.likes_given > 0) {
      const ratio = (p.likes_given + 1) / (p.likes_received + 1);
      const tag =
        ratio >= 2 ? "Certified Hype Man. 📣" : ratio <= 0.5 ? "The people love you. ❤️" : "A fair trade.";
      const ml = p.most_liked_roll;
      add(
        "likes",
        PINK,
        <>
          <Kicker color={PINK}>FAN FAVORITE</Kicker>
          {ml && (
            <>
              <Line>
                Your most-liked roll: <Hi color={PINK}>{ml.likes} ❤️</Hi> on {formatShortDate(ml.date)}
              </Line>
              <ComboPair combo={ml} />
              {ml.is_doubles && (
                <div className="flex justify-center">
                  <DoublesBadge isDailyDouble={ml.is_daily_double} />
                </div>
              )}
            </>
          )}
          <Line>
            You gave <Hi>{p.likes_given}</Hi> likes and got <Hi>{p.likes_received}</Hi>.
          </Line>
          <Sub>{tag}</Sub>
        </>
      );
    }
  }

  // 14. Achievements
  if (p.achievements.length > 0) {
    const rarest = [...p.achievements].sort((a, b) => a.unlock_count - b.unlock_count)[0];
    add(
      "achievements",
      GOLD,
      <>
        <Kicker color={GOLD}>ACHIEVEMENTS UNLOCKED</Kicker>
        <Big color={GOLD}>{p.achievements.length}</Big>
        <div className="flex justify-center mt-4">
          <AchievementPills achievements={p.achievements} />
        </div>
        <Line>
          {p.achievements.length > 1 ? "Rarest: " : ""}
          {rarest.emoji} <Hi>{rarest.name}</Hi>
        </Line>
        <Sub>
          {rarest.unlock_count <= 1
            ? "You're the only one who has it."
            : rarest.unlock_count >= p.total_users
              ? "Everyone has this one. Still counts."
              : `Only ${rarest.unlock_count} of ${p.total_users} rollers have it.`}
          {p.punch_cards_this_year > 1 && ` Plus ${p.punch_cards_this_year} punch cards filled 👊.`}
        </Sub>
      </>
    );
  }

  // 15. Your award
  const mine = superlatives.find((s) => s.user_id === userId);
  add(
    "my-award",
    GOLD,
    mine ? (
      <>
        <Kicker color={GOLD}>YOUR YEARBOOK AWARD</Kicker>
        <p className="text-[88px] leading-none my-3">{mine.emoji}</p>
        <Big color={GOLD} size={34}>
          {mine.title.toUpperCase()}
        </Big>
        <Line>{mine.blurb}</Line>
        <Sub>Everyone with {SUPERLATIVE_MIN_ROLLS}+ rolls gets exactly one award. This one is yours.</Sub>
      </>
    ) : (
      <>
        <Kicker color={GOLD}>YOUR YEARBOOK AWARD</Kicker>
        <p className="text-[88px] leading-none my-3">🔒</p>
        <Line>
          Yearbook awards go to rollers with {SUPERLATIVE_MIN_ROLLS}+ rolls. You had {n}.
        </Line>
        <Sub>Next year. We believe in you.</Sub>
      </>
    )
  );

  // ── The Year of Rolling Dice ──
  add(
    "bar-intro",
    GREEN,
    <>
      <Kicker color={GREEN}>THE YEAR OF ROLLING DICE</Kicker>
      <Big color={GREEN}>{g.total_rolls.toLocaleString()}</Big>
      <Kicker>ROLLS</Kicker>
      <Line>
        <Hi>{plural(g.total_rolls * 2, "drink")}</Hi>. <Hi>{plural(g.rollers, "roller")}</Hi>.{" "}
        <Hi>{plural(g.nights, "night")}</Hi>.
      </Line>
    </>
  );

  if (g.busiest_night) {
    const busiestHour = argMax(g.hour_counts);
    add(
      "bar-busiest",
      GREEN,
      <>
        <Kicker color={GREEN}>BUSIEST NIGHT</Kicker>
        <Big color={GREEN} size={60}>
          {formatShortDate(g.busiest_night.date)}
        </Big>
        <Line>
          {weekdayOf(g.busiest_night.date)}: <Hi>{plural(g.busiest_night.rolls, "roll")}</Hi> from{" "}
          <Hi>{plural(g.busiest_night.rollers, "roller")}</Hi>.
        </Line>
        <Sub>Busiest hour of the year: {formatHourRange(busiestHour)}.</Sub>
      </>
    );
  }

  if (g.top_combo && g.rarest_combo) {
    const expected = g.total_rolls / 64;
    add(
      "bar-combos",
      GOLD,
      <>
        <Kicker color={GOLD}>THE BAR&apos;S COMBO</Kicker>
        <ComboPair combo={g.top_combo} />
        <Line>
          Rolled <Hi>{plural(g.top_combo.count ?? 0, "time")}</Hi> (fair dice: {round1(expected)}).
        </Line>
        <Card>
          <p className="text-text-secondary text-[12px] font-display tracking-[0.18em] mb-1">RAREST</p>
          <p className="text-text-primary text-[15px]">
            {comboName(g.rarest_combo)}: just <Hi>{plural(g.rarest_combo.count ?? 0, "roll")}</Hi>.
          </p>
          {g.unrolled_combos > 0 && (
            <Sub>{plural(g.unrolled_combos, "combo")} never got rolled at all.</Sub>
          )}
        </Card>
      </>
    );
  }

  if (g.total_rolls >= 16) {
    const rv = dieVerdict(g.red_freq);
    const wv = dieVerdict(g.white_freq);
    add(
      "bar-fairness",
      PURPLE,
      <>
        <Kicker color={PURPLE}>ARE THE DICE FAIR?</Kicker>
        <VerdictLine die="Red die" v={rv} />
        <VerdictLine die="White die" v={wv} />
        <Sub>
          {wv.p >= 0.05 ? "Stop complaining about the dice and drink or something." : "Okay... maybe the Malört thing is a conspiracy."}
        </Sub>
        <FaceChart freq={g.red_freq} color={PINK} title="● EVERY RED ROLL" />
        <FaceChart freq={g.white_freq} color={WHITE} title="○ EVERY WHITE ROLL" />
      </>
    );
  }

  if (g.milestone_roll || g.first_roll) {
    add(
      "bar-milestones",
      ORANGE,
      <>
        <Kicker color={ORANGE}>MILESTONES</Kicker>
        {g.milestone_roll && (
          <>
            <Big color={ORANGE} size={56}>
              #{g.milestone_roll.number.toLocaleString()}
            </Big>
            <Line>
              belonged to <Hi>@{g.milestone_roll.username}</Hi> on {formatShortDate(g.milestone_roll.date)}.
            </Line>
            <ComboPair combo={g.milestone_roll} />
          </>
        )}
        {g.first_roll && (
          <Sub>
            The year opened with @{g.first_roll.username}: {comboName(g.first_roll)}.
          </Sub>
        )}
      </>
    );
  }

  if (g.most_liked_roll || g.twinsies_events > 0) {
    const expected = expectedTwinsies(g.night_roll_counts);
    const ml = g.most_liked_roll;
    add(
      "bar-social",
      PINK,
      <>
        {ml && (
          <>
            <Kicker color={PINK}>MOST-LIKED ROLL OF THE YEAR</Kicker>
            <Big color={PINK} size={52}>
              {ml.likes} ❤️
            </Big>
            <Line>
              @{ml.username} on {formatShortDate(ml.date)}
            </Line>
            <ComboPair combo={ml} />
          </>
        )}
        {g.twinsies_events > 0 && (
          <Card>
            <p className="text-text-primary text-[15px]">
              👯 Twinsies happened <Hi>{plural(g.twinsies_events, "time")}</Hi>. Pure chance predicted about{" "}
              <Hi>{Math.round(expected)}</Hi>.
            </p>
            <Sub>
              {g.twinsies_events > expected * 1.2
                ? "Are you all coordinating?"
                : g.twinsies_events < expected * 0.8
                  ? "You're all actively avoiding each other."
                  : "Right where the math says. Spooky."}
            </Sub>
          </Card>
        )}
      </>
    );
  }

  // ── Heavyweight Title Fight ──
  const hw = g.heavyweight;
  if (hw && hw.fighters.length === 2) {
    const [a, b] = hw.fighters;
    let monthsA = 0;
    let monthsB = 0;
    let ties = 0;
    a.months.forEach((ma, i) => {
      const mb = b.months[i];
      if (ma === 0 && mb === 0) return;
      if (ma > mb) monthsA++;
      else if (mb > ma) monthsB++;
      else ties++;
    });
    const champ = monthsA === monthsB ? (a.rolls >= b.rolls ? a : b) : monthsA > monthsB ? a : b;
    const margin = Math.abs(monthsA - monthsB) <= 1 ? "by a nose" : "decisively";
    const rows: { label: string; a: ReactNode; b: ReactNode }[] = [
      { label: "Rolls", a: a.rolls, b: b.rolls },
      { label: "Nights", a: a.nights, b: b.nights },
      { label: "Months won", a: monthsA, b: ties > 0 ? `${monthsB} (${ties} tie${ties > 1 ? "s" : ""})` : monthsB },
      {
        label: "Doubles (exp.)",
        a: `${a.doubles} (${round1(a.rolls * P_DOUBLES)})`,
        b: `${b.doubles} (${round1(b.rolls * P_DOUBLES)})`,
      },
      { label: "Malört", a: a.malort, b: b.malort },
      { label: "Combos", a: `${a.combos}/64`, b: `${b.combos}/64` },
      { label: "First on shared nights", a: a.first_on_shared, b: b.first_on_shared },
    ];
    add(
      "heavyweight",
      GOLD,
      <>
        <Kicker color={GOLD}>🥊 HEAVYWEIGHT TITLE FIGHT</Kicker>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <p className="font-display text-[15px] truncate" style={{ color: PINK }}>
            @{a.username}
          </p>
          <p className="font-display text-[11px] text-text-secondary">VS</p>
          <p className="font-display text-[15px] truncate" style={{ color: WHITE }}>
            @{b.username}
          </p>
        </div>
        <div className="bg-surface/80 rounded-2xl border border-surface-2 px-3 py-1 mt-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 border-b border-surface-2 last:border-0"
            >
              <span className="font-display text-[14px]" style={{ color: PINK }}>
                {r.a}
              </span>
              <span className="text-text-secondary text-[10px] tracking-wider uppercase text-center">{r.label}</span>
              <span className="font-display text-[14px]" style={{ color: WHITE }}>
                {r.b}
              </span>
            </div>
          ))}
        </div>
        <DualMonthBars a={a.months} b={b.months} colorA={PINK} colorB={WHITE} />
        <Sub>
          Shared nights: {hw.shared_nights}. Twinsies with each other: {hw.twinsies}.
        </Sub>
        <Line>
          Champion of {year}: <Hi>@{champ.username}</Hi>, {margin}.
        </Line>
      </>
    );
  }

  // ── The Yearbook ──
  const PAGE = 5;
  for (let i = 0; i < superlatives.length; i += PAGE) {
    const page = superlatives.slice(i, i + PAGE);
    add(
      `yearbook-${i / PAGE}`,
      GOLD,
      <>
        <Kicker color={GOLD}>
          THE YEARBOOK{superlatives.length > PAGE ? ` · ${i / PAGE + 1}/${Math.ceil(superlatives.length / PAGE)}` : ""}
        </Kicker>
        <div className="flex flex-col gap-2 text-left">
          {page.map((s) => (
            <div
              key={s.user_id}
              className="bg-surface/80 rounded-xl border px-3 py-2.5"
              style={{ borderColor: s.user_id === userId ? GOLD : "#252525" }}
            >
              <p className="text-text-primary text-[14px]">
                {s.emoji} <span className="font-display tracking-wider">{s.title.toUpperCase()}</span>{" "}
                <span className="text-text-secondary">@{s.username}</span>
              </p>
              <p className="text-text-secondary text-[12px] mt-0.5 leading-snug">{s.blurb}</p>
            </div>
          ))}
        </div>
        {i === 0 && (
          <Sub>One award per roller ({SUPERLATIVE_MIN_ROLLS}+ rolls), scored against fair dice and each other.</Sub>
        )}
      </>
    );
  }

  // ── Persona + share card ──
  const persona = pickPersona(p);
  const faces = p.red_freq.map((r, i) => r + p.white_freq[i]);
  const shareRows: { label: string; value: string }[] =
    n > 0
      ? [
          { label: "Rolls", value: n.toLocaleString() },
          { label: "Lucky number", value: `${argMax(faces) + 1}` },
          { label: "Luck index", value: formatSigma(binomialZ(p.doubles, n, P_DOUBLES)) },
          ...(p.signature_combo ? [{ label: "Usual", value: comboName(p.signature_combo) }] : []),
          ...(mine ? [{ label: "Award", value: `${mine.emoji} ${mine.title}` }] : []),
        ]
      : [];
  add(
    "persona",
    PINK,
    <>
      <Kicker color={PINK}>YOU ARE…</Kicker>
      <p className="text-[48px] leading-none my-1">{persona.emoji}</p>
      <Big color={PINK} size={32}>
        {persona.title}
      </Big>
      <Line>{persona.line}</Line>
      {shareRows.length > 0 && (
        <div
          className="rounded-2xl border px-4 py-3 mt-4 text-left"
          style={{ borderColor: PINK, background: "linear-gradient(160deg, #FF2D5522, #1A1A1A 60%)" }}
        >
          <p className="font-display text-[10px] tracking-[0.25em] text-text-secondary">
            @{p.username.toUpperCase()} · WRAPPED {year}
          </p>
          {shareRows.map((r) => (
            <StatRow key={r.label} label={r.label} value={r.value} />
          ))}
        </div>
      )}
      <Sub>Screenshot this and send it to the group chat.</Sub>
    </>
  );

  return slides;
}
