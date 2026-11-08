"use client";

/**
 * Neon vertical bar chart (one bar per label) used on /stats and in the
 * Wrapped story deck. Bars grow in with a staggered animation.
 */
export function VerticalBarChart({
  data,
  color,
  height = 90,
}: {
  data: { label: string; count: number }[];
  color: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const barAreaH = height - 22;
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * barAreaH, 2);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex-1 w-full flex items-end">
              <div
                style={{
                  width: "100%",
                  height: barH,
                  background: color,
                  boxShadow: `0 0 8px ${color}80`,
                  borderRadius: "2px 2px 0 0",
                  transformOrigin: "bottom",
                  animation: `grow-bar 0.5s ${i * 0.05}s ease-out both`,
                }}
              />
            </div>
            <span className="font-display text-[10px] text-text-secondary">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
