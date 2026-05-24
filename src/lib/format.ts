/** Shared display formatters. Keep these dependency-free so server and
 *  client components can both import. */

/** "MAY 22" — used in twinsies log and elsewhere we want a tight date pill. */
export function formatShortDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

/** "5/22" — used by admin chart axes that need to fit a lot of ticks. */
export function formatMonthDay(yyyyMmDd: string): string {
  const [, m, d] = yyyyMmDd.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

/** "just now" / "5m ago" / "3h ago" / "2d ago". */
export function formatRelativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const NEON_COLORS = [
  "#FF2D55", "#FFD600", "#00FF88", "#FF6B9D",
  "#FFF066", "#66FFB3", "#FF9966", "#AA66FF",
];

/** Deterministic neon color per drink name — so the same drink always
 *  shows up in the same color across pages. */
export function getDrinkColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return NEON_COLORS[h % NEON_COLORS.length];
}

/** The double-glow textShadow used by neon stat headlines. */
export function getNeonGlow(color: string): string {
  return `0 0 10px ${color}80, 0 0 22px ${color}40`;
}

/** Pad sparse daily-count data with zero-count days for the last `days` days,
 *  with labels formatted via `formatMonthDay`. Used by admin charts. */
export function fillDateRange(
  data: { day: string; count: number }[],
  days: number
): { day: string; count: number }[] {
  const map = Object.fromEntries(data.map((d) => [d.day, d.count]));
  const result: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ day: formatMonthDay(key), count: map[key] ?? 0 });
  }
  return result;
}
