export type GridSize = "sm" | "md";

export function DoublesGrid({ numbers, size = "md" }: { numbers: number[]; size?: GridSize }) {
  const cell = size === "sm" ? "w-4 h-4 text-[8px]" : "w-[22px] h-[22px] text-[10px]";
  const hit = new Set(numbers);
  return (
    <div className="mt-2 flex items-center gap-1">
      {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          className={`${cell} rounded flex items-center justify-center font-display`}
          style={
            hit.has(n)
              ? { background: "#FF2D55", color: "#0D0D0D", boxShadow: "0 0 6px rgba(255,45,85,0.5)" }
              : { background: "#0D0D0D", border: "1px solid #252525", color: "#555" }
          }
        >
          {n}
        </div>
      ))}
    </div>
  );
}

export function AroundTheWorldGrid({ combos, size = "md" }: { combos: string[]; size?: GridSize }) {
  const cell = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const label = size === "sm" ? "text-[7px]" : "text-[8px]";
  const pad = size === "sm" ? "pl-3.5" : "pl-5";
  const rowLabel = size === "sm" ? "w-4" : "w-5";
  const hit = new Set(combos);
  return (
    <div className="mt-2 overflow-x-auto">
      <div className="inline-block">
        <div className={`flex gap-0.5 mb-0.5 ${pad}`}>
          {Array.from({ length: 8 }, (_, i) => i + 1).map((w) => (
            <div key={w} className={`${cell} ${label} text-text-secondary flex items-center justify-center`}>{w}</div>
          ))}
        </div>
        {Array.from({ length: 8 }, (_, ri) => ri + 1).map((r) => (
          <div key={r} className="flex gap-0.5 mb-0.5">
            <div className={`${cell} ${label} text-neon-pink flex items-center justify-center shrink-0`}>{r}</div>
            {Array.from({ length: 8 }, (_, wi) => wi + 1).map((w) => (
              <div
                key={w}
                className={`${cell} rounded-sm`}
                style={hit.has(`${r}-${w}`) ? { background: "#FFD600" } : { background: "#252525" }}
              />
            ))}
          </div>
        ))}
        <div className="flex gap-1 mt-1">
          <span className={`text-[8px] text-neon-pink ${rowLabel} shrink-0`}>Red</span>
          <span className="text-[8px] text-text-secondary">{hit.size}/64 combos hit</span>
        </div>
      </div>
    </div>
  );
}

export function PunchCardGrid({
  detail,
  size = "md",
}: {
  detail: { red?: number[]; white?: number[] };
  size?: GridSize;
}) {
  const cell = size === "sm" ? "w-4 h-4 text-[8px]" : "w-5 h-5 text-[10px]";
  const red = detail.red ?? [];
  const white = detail.white ?? [];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-neon-pink text-[10px] w-8 font-display">Red</span>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={`${cell} rounded flex items-center justify-center font-display`}
            style={
              red.includes(n)
                ? { background: "#FF2D55", color: "#0D0D0D", boxShadow: "0 0 5px rgba(255,45,85,0.5)" }
                : { background: "#0D0D0D", border: "1px solid #252525", color: "#555" }
            }
          >
            {n}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-text-secondary text-[10px] w-8 font-display">White</span>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={`${cell} rounded flex items-center justify-center font-display`}
            style={
              white.includes(n)
                ? { background: "#F5F5F5", color: "#0D0D0D" }
                : { background: "#0D0D0D", border: "1px solid #252525", color: "#555" }
            }
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
