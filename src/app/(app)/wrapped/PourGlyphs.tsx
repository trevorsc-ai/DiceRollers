"use client";

import { useId } from "react";
import type { VesselId } from "@/lib/wrapped";

/**
 * Vessel pictures for the Wrapped "Pour" slides. Each vessel is drawn dim, then
 * again lit and clipped to `fill` (0..1), so 1.4 kegs is one full keg and a
 * second one 40% full. `top`/`bottom` are the y-range (in a 48x48 box) of the
 * part that holds liquid; handles, taps and bubbles above it only light up at 100%.
 */

const GOLD = "#FFD600";

interface Shape {
  top: number;
  bottom: number;
  /** SVG children; elements with fill="none" are strokes only (handles, bubbles). */
  body: JSX.Element;
  /** Dark lines drawn over the vessel (keg hoops). */
  detail?: JSX.Element;
}

const SHAPES: Partial<Record<VesselId, Shape>> = {
  mug: {
    top: 12,
    bottom: 42,
    body: (
      <>
        <path d="M8 12H32V38Q32 42 28 42H12Q8 42 8 38Z" />
        <path d="M32 17H38Q42 17 42 22V28Q42 33 38 33H32" fill="none" />
      </>
    ),
  },
  pint: { top: 8, bottom: 43, body: <path d="M11 8H37L34 43H14Z" /> },
  gulp: {
    top: 13,
    bottom: 43,
    body: (
      <>
        <path d="M13 13H35L32 43H16Z" />
        <rect x="11" y="9" width="26" height="4" rx="1.5" />
        <path d="M27 9L31 2" fill="none" />
      </>
    ),
  },
  pitcher: {
    top: 8,
    bottom: 43,
    body: (
      <>
        <path d="M10 8H33L31 43H12Z" />
        <path d="M33 14H39Q43 14 43 18V28Q43 32 39 32H32" fill="none" />
      </>
    ),
  },
  toilet: {
    top: 4,
    bottom: 40,
    body: (
      <>
        <rect x="14" y="4" width="20" height="10" rx="2" />
        <path d="M9 18H39Q39 31 29 34V40H19V34Q9 31 9 18Z" />
      </>
    ),
  },
  bucket: {
    top: 14,
    bottom: 43,
    body: (
      <>
        <path d="M9 14H39L36 43H12Z" />
        <path d="M9 14Q24 0 39 14" fill="none" />
      </>
    ),
  },
  keg: {
    top: 7,
    bottom: 43,
    body: (
      <>
        <rect x="11" y="7" width="26" height="36" rx="6" />
        <rect x="20" y="2" width="8" height="6" rx="2" />
      </>
    ),
    detail: <path d="M11 16H37M11 34H37" />,
  },
  tub: {
    top: 22,
    bottom: 38,
    body: (
      <>
        <path d="M4 22H44V28Q44 38 34 38H14Q4 38 4 28Z" />
        <circle cx="12" cy="42" r="2" />
        <circle cx="36" cy="42" r="2" />
        <path d="M8 22V13Q8 9 12 9H17" fill="none" />
      </>
    ),
  },
  hottub: {
    top: 18,
    bottom: 40,
    body: (
      <>
        <path d="M3 18H45V32Q45 40 37 40H11Q3 40 3 32Z" />
        <circle cx="15" cy="10" r="2.2" fill="none" />
        <circle cx="24" cy="6" r="2.2" fill="none" />
        <circle cx="33" cy="10" r="2.2" fill="none" />
      </>
    ),
  },
};

/** The gallon of milk has no drawing; it uses an emoji with the same dim/lit trick. */
const EMOJI: Partial<Record<VesselId, string>> = { jug: "🥛" };

/** One vessel, `fill` (0..1) of the way full. */
export function VesselGlyph({ id, fill = 1, size = 48 }: { id: VesselId; fill?: number; size?: number }) {
  // useId() contains colons, which break url(#...) references in some browsers.
  const clipId = `pour-${useId().replace(/:/g, "")}`;
  const emoji = EMOJI[id];
  const f = Math.min(Math.max(fill, 0), 1);

  if (emoji) {
    return (
      <span className="relative inline-block text-center leading-[1.15]" style={{ fontSize: size * 0.85, width: size, height: size }}>
        <span style={{ filter: "grayscale(1) brightness(0.33)" }}>{emoji}</span>
        <span className="absolute left-0 top-0 w-full" style={{ clipPath: `inset(${(1 - f) * 100}% 0 0 0)` }}>
          {emoji}
        </span>
      </span>
    );
  }

  const shape = SHAPES[id];
  if (!shape) return null;
  const y = f >= 0.999 ? 0 : shape.bottom - (shape.bottom - shape.top) * f;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ overflow: "visible" }} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y={y} width="48" height={48 - y} />
        </clipPath>
      </defs>
      <g fill="#1b1b1b" stroke="#3b3b3b" strokeWidth="1.2">
        {shape.body}
      </g>
      <g
        fill={GOLD}
        stroke={GOLD}
        strokeWidth="1.2"
        clipPath={`url(#${clipId})`}
        style={{ filter: `drop-shadow(0 0 3px ${GOLD}99)` }}
      >
        {shape.body}
      </g>
      {shape.detail && (
        <g fill="none" stroke="#0D0D0D" strokeWidth="1.6" strokeLinecap="round">
          {shape.detail}
        </g>
      )}
    </svg>
  );
}

const UNIT_SIZE: Partial<Record<VesselId, number>> = { keg: 64, bucket: 56, tub: 60, toilet: 50 };

/** `count` vessels in a row: whole ones lit, the last one partially filled. */
export function VesselUnits({ id, count }: { id: VesselId; count: number }) {
  const whole = Math.floor(count + 1e-9);
  const part = count - whole;
  const size = UNIT_SIZE[id] ?? 50;
  return (
    <div className="flex flex-wrap justify-center items-end gap-1.5 mt-4 mb-1 mx-auto max-w-[300px]">
      {Array.from({ length: whole }, (_, i) => (
        <VesselGlyph key={i} id={id} size={size} />
      ))}
      {part > 0.02 && <VesselGlyph id={id} fill={part} size={size} />}
    </div>
  );
}
