#!/usr/bin/env python3
"""Generate the circular neon QR code for diceroll.today.

Usage: python3 scripts/brand/make_qr.py [out.svg] [url]
Needs: pip install segno

Palette mirrors tailwind.config.ts (background, neon-pink, neon-gold, neon-green).
Error correction is level H so the centre die and the decorative ring never
cost us a scan.
"""
import math
import random
import sys

import segno

OUT = sys.argv[1] if len(sys.argv) > 1 else "docs/brand/diceroll-qr.svg"
URL = sys.argv[2] if len(sys.argv) > 2 else "https://diceroll.today"

BG, SURFACE = "#0D0D0D", "#1A1A1A"
PINK, GOLD, GREEN, WHITE = "#FF2D55", "#FFD600", "#00FF88", "#F5F5F5"

SIZE, C = 1024, 512
R_OUTER, R_PIPS, R_INNER = 497, 468, 440
R_CORNER = 424  # QR square corners sit on this circle

qr = segno.make(URL, error="h", boost_error=False)
m = qr.matrix
n = len(m)
side = R_CORNER * math.sqrt(2)
mod = side / n
ox = oy = C - side / 2


def px(col, row):  # module centre in SVG space
    return ox + (col + 0.5) * mod, oy + (row + 0.5) * mod


def in_finder(col, row):
    return (row < 7 and col < 7) or (row < 7 and col >= n - 7) or (row >= n - 7 and col < 7)


CLEAR = 3.7 * mod  # keep-out radius for the centre die

def die(cx, cy, s, rot, face, fill, pip, stroke=None, sw=0, glow=False):
    pips = {
        1: [(0, 0)],
        2: [(-1, -1), (1, 1)],
        3: [(-1, -1), (0, 0), (1, 1)],
        4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
        5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)],
        6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)],
    }[face]
    o = [f'<g transform="translate({cx:.2f} {cy:.2f}) rotate({rot})"' + (' filter="url(#glow)"' if glow else "") + ">"]
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    o.append(f'<rect x="{-s/2:.2f}" y="{-s/2:.2f}" width="{s}" height="{s}" rx="{s*0.24:.2f}" fill="{fill}"{st}/>')
    for px_, py_ in pips:
        o.append(f'<circle cx="{px_*s*0.26:.2f}" cy="{py_*s*0.26:.2f}" r="{s*0.075:.2f}" fill="{pip}"/>')
    o.append("</g>")
    return "".join(o)


svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">']
svg.append(f"""<title>diceroll.today</title>
<defs>
  <radialGradient id="plate" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="{SURFACE}"/><stop offset="1" stop-color="{BG}"/></radialGradient>
  <linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="{C-R_CORNER}" y1="{C-R_CORNER}" x2="{C+R_CORNER}" y2="{C+R_CORNER}">
    <stop offset="0" stop-color="{PINK}"/><stop offset="0.55" stop-color="#FF7A2E"/><stop offset="1" stop-color="{GOLD}"/>
  </linearGradient>
  <linearGradient id="dieFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{PINK}"/><stop offset="1" stop-color="#C41238"/></linearGradient>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="glowSoft" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>""")

# plate + rings
svg.append(f'<circle cx="{C}" cy="{C}" r="{R_OUTER+10}" fill="{BG}"/>')
svg.append(f'<circle cx="{C}" cy="{C}" r="{R_OUTER-4}" fill="url(#plate)"/>')
svg.append(f'<circle cx="{C}" cy="{C}" r="{R_OUTER}" fill="none" stroke="{PINK}" stroke-width="7" filter="url(#glow)"/>')
svg.append(f'<circle cx="{C}" cy="{C}" r="{R_INNER}" fill="none" stroke="{GOLD}" stroke-width="2.5" opacity="0.9" filter="url(#glowSoft)"/>')

# pip band: alternating dots with mini dice at the cardinal points
count = 72
band = []
for i in range(count):
    a = 2 * math.pi * i / count - math.pi / 2
    if i % (count // 4) in (0, 1, count // 4 - 1):  # leave room for the dice
        continue
    x, y = C + R_PIPS * math.cos(a), C + R_PIPS * math.sin(a)
    big = i % 2 == 0
    band.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{4.6 if big else 2.8}" fill="{PINK if big else GOLD}"/>')
svg.append(f'<g filter="url(#glowSoft)">{"".join(band)}</g>')
dice = [(0, 5, PINK), (90, 2, GOLD), (180, 6, PINK), (270, 3, GOLD)]
for deg, face, col in dice:
    a = math.radians(deg - 90)
    svg.append(die(C + R_PIPS * math.cos(a), C + R_PIPS * math.sin(a), 38, deg % 180 and 0 or 0,
                   face, BG, col, stroke=col, sw=3, glow=True))

# faint pip texture in the gaps between the square code and the inner ring
random.seed(6)
tex = []
step = 22
for gy in range(-24, 25):
    for gx in range(-24, 25):
        x = C + gx * step + (step / 2 if gy % 2 else 0)
        y = C + gy * step * 0.866
        d = math.hypot(x - C, y - C)
        inside_sq = abs(x - C) < side / 2 + 1.6 * mod and abs(y - C) < side / 2 + 1.6 * mod
        if inside_sq or d > R_INNER - 16:
            continue
        tex.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{random.choice([1.6, 2.2, 3.0])}" fill="{random.choice([PINK, GOLD, GREEN])}" opacity="0.16"/>')
svg.append(f'<g>{"".join(tex)}</g>')

# data modules as glowing dots, shrinking slightly toward the rim
maxd = R_CORNER
dots = []
for row in range(n):
    for col in range(n):
        if not m[row][col] or in_finder(col, row):
            continue
        x, y = px(col, row)
        d = math.hypot(x - C, y - C)
        if d < CLEAR:
            continue
        r = mod * (0.47 - 0.07 * min(d / maxd, 1))
        dots.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}"/>')
svg.append(f'<g fill="url(#ink)" filter="url(#glowSoft)">{"".join(dots)}</g>')

# finder "eyes": ring + core
eyes = []
for c0, r0 in ((0, 0), (n - 7, 0), (0, n - 7)):
    x0, y0 = ox + c0 * mod, oy + r0 * mod
    eyes.append(f'<rect x="{x0+mod/2:.2f}" y="{y0+mod/2:.2f}" width="{6*mod:.2f}" height="{6*mod:.2f}" rx="{2.2*mod:.2f}" fill="none" stroke="url(#ink)" stroke-width="{mod:.2f}"/>')
    eyes.append(f'<rect x="{x0+2*mod:.2f}" y="{y0+2*mod:.2f}" width="{3*mod:.2f}" height="{3*mod:.2f}" rx="{1.15*mod:.2f}" fill="{GREEN}"/>')
svg.append(f'<g filter="url(#glowSoft)">{"".join(eyes)}</g>')

# centre die
svg.append(f'<circle cx="{C}" cy="{C}" r="{CLEAR-4:.1f}" fill="{BG}" stroke="{GOLD}" stroke-width="3" filter="url(#glowSoft)"/>')
svg.append(die(C, C, CLEAR * 1.12, 12, 6, "url(#dieFill)", WHITE, stroke=WHITE, sw=2.5, glow=True))

svg.append("</svg>")
open(OUT, "w").write("\n".join(svg))
print(f"wrote {OUT}  ({n}x{n} modules, version {qr.version}, {URL})")
