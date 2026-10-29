"use client";

interface HalloweenOverlayProps {
  active: boolean;
}

// Fixed positions so the layout is stable between renders.
const SPOOKS = [
  { emoji: "🦇", top: "9%", left: "6%", size: 26, delay: 0 },
  { emoji: "👻", top: "16%", left: "82%", size: 30, delay: 1.4 },
  { emoji: "🦇", top: "38%", left: "88%", size: 22, delay: 2.8 },
  { emoji: "🕸️", top: "2%", left: "90%", size: 34, delay: 0.6 },
  { emoji: "🎃", top: "62%", left: "4%", size: 26, delay: 3.6 },
  { emoji: "👻", top: "78%", left: "86%", size: 24, delay: 2.0 },
  { emoji: "🦇", top: "52%", left: "48%", size: 18, delay: 4.4 },
];

// Decorative only: sits behind page content and never intercepts taps.
export default function HalloweenOverlay({ active }: HalloweenOverlayProps) {
  if (!active) return null;

  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(168,85,247,0.14), transparent 60%), radial-gradient(ellipse at bottom, rgba(255,122,0,0.10), transparent 55%)",
        }}
      />
      {SPOOKS.map((s, i) => (
        <span
          key={i}
          className="absolute spooky-float select-none"
          style={{
            top: s.top,
            left: s.left,
            fontSize: s.size,
            animationDelay: `${s.delay}s, ${s.delay}s`,
          }}
        >
          {s.emoji}
        </span>
      ))}
    </div>
  );
}
