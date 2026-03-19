---
planStatus:
  planId: plan-dice-roll-tracker-v1
  title: "Jackie Lee's Dice Roll Tracker — V1 Build"
  status: ready-for-development
  planType: feature
  priority: high
  owner: travis-scavone
  stakeholders: []
  tags: [next-js, supabase, tailwind, mobile-first, dice-roller]
  created: "2026-03-19"
  updated: "2026-03-19T21:20:00.000Z"
  progress: 0
---

# Jackie Lee's Dice Roll Tracker — V1 Build Plan

## Overview

A mobile-first web app that lets patrons of Jackie Lee's (116 Kennedy St NW, Washington DC) log their dice roll beer-and-shot combos, browse the current drink menu, and explore fun stats about their rolling history. Dark, dive-bar aesthetic with neon accents.

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14+ (App Router) | Deployed on Vercel |
| Database | Supabase Postgres | Direct JS client — **no ORM** |
| Auth | Supabase Auth | Email/password + username |
| Storage | Supabase Storage | Drink logo uploads |
| Styling | Tailwind CSS | Mobile-first, dark theme |
| Charts | Recharts | Neon-on-dark stats visuals |
| Hosting | Vercel | Auto-deploy from GitHub `main` |

## Key Design Decisions

- **Dice interaction**: Option C — number picker styled as octagonal die face, with animation on selection
- **Logo lookup**: Manual admin upload only in V1 (auto-lookup deferred to backlog)
- **Mickey's puzzles**: Static JSON, date-seeded selection, sourced from pozzlify.com + well-known additions
- **Admin seed**: Included in SQL migration, password removed from file post-deploy
- **No ORM**: All DB access via `@supabase/supabase-js` client directly

## Supabase Config

- **Project URL**: `https://gqiolrxlaausuwehmotw.supabase.co`
- **Anon Key**: Set via `NEXT_PUBLIC_SUPABASE_ANON_KEY` env var

---

## Phases

### Phase 1: Project Scaffolding
- [ ] Initialize Next.js 14+ with App Router and TypeScript
- [ ] Configure Tailwind CSS with the dive-bar color palette
- [ ] Install and configure `@supabase/supabase-js` and `@supabase/ssr`
- [ ] Set up environment variables (`.env.local` template)
- [ ] Initialize git repo and connect to GitHub remote
- [ ] Create base layout with dark theme and Google Font (bold/retro)

### Phase 2: Database Schema & Migrations
- [ ] Create `/supabase/migrations/` directory structure
- [ ] Write initial migration: `profiles` table (extends auth.users)
- [ ] Write initial migration: `menu_items` table with unique constraint
- [ ] Write initial migration: `rolls` table with snapshot fields
- [ ] Write initial migration: `roll_likes` table with unique constraint
- [ ] Write RLS policies (user read/write own rolls, public read for opted-in users, admin menu edit)
- [ ] Seed default menu (Red Die beers 1-8, White Die shots 1-8)
- [ ] Seed admin user (travis.scavone@protonmail.com / double6s / is_admin=true)
- [ ] **Post-deploy**: Remove hardcoded password from migration file

### Phase 3: Authentication
- [ ] Build `/login` page with Login/Sign Up toggle
- [ ] Implement Supabase Auth signup (email, password, username)
- [ ] Implement Supabase Auth login (email, password)
- [ ] Create auth context/provider for session management
- [ ] Add middleware to protect authenticated routes
- [ ] Style login page: dark bg, neon Jackie Lee's branding, bold typography

### Phase 4: Daily Mickey's Puzzle Modal
- [ ] Create `mickeys-puzzles.json` with 60-80 puzzles (emoji + answer)
- [ ] Build full-screen puzzle modal component
- [ ] Implement date-seeded puzzle selection (`dayOfYear % totalPuzzles`)
- [ ] Add "seen today" check via localStorage
- [ ] Style with Mickey's branding and dive-bar aesthetic
- [ ] Add tap-to-reveal answer interaction

### Phase 5: Core Pages

#### 5a: Dice Roll Entry (`/roll`)
- [ ] Build octagonal die number picker component (1-8) with selection animation
- [ ] Create red die (beers) and white die (shots) side-by-side layout
- [ ] Auto-populate date/time
- [ ] Fetch and display corresponding drinks from menu on die selection
- [ ] Show drink name + logo (or placeholder) for each die
- [ ] Detect doubles (red == white) and show celebration UI
- [ ] Detect Malort (white die == 6) and show Malort celebration
- [ ] "Save Roll" button → insert into `rolls` table with snapshotted drink data
- [ ] Post-save confirmation with share-to-feed option (if user is public)

#### 5b: Current Menu (`/menu`)
- [ ] Display menu in two columns/sections: Red Die (Beers) + White Die (Shots)
- [ ] Show die number, drink name, logo thumbnail per entry
- [ ] Read-only view for non-admin users
- [ ] Admin edit mode: inline edit button per drink slot
- [ ] Admin: change drink name, upload logo image to Supabase Storage
- [ ] Admin: preview uploaded image before saving

#### 5c: History (`/history`)
- [ ] Scrollable list of user's rolls, newest first
- [ ] Each entry: date/time, red die # + beer name/logo, white die # + shot name/logo, doubles badge
- [ ] Date range filter
- [ ] Drink name search
- [ ] Doubles-only toggle filter

#### 5d: Stats Dashboard (`/stats`)
- [ ] Hero number: total rolls count
- [ ] Total doubles count + doubles percentage
- [ ] Die number frequency chart (grouped bar, red vs white, 1-8)
- [ ] Drink frequency chart (most common beers + shots)
- [ ] Day-of-week pattern chart
- [ ] Rolling streak tracker (consecutive days)
- [ ] Doubles history timeline
- [ ] Leaderboard section (public users only): top rollers, top doubles, most popular drinks

#### 5e: Social Feed (`/feed`)
- [ ] Chronological feed of rolls from public users
- [ ] Each item: username, timestamp, die numbers, drink names, doubles badge
- [ ] Dice emoji like button with bounce animation
- [ ] Like count display, unlike on re-tap
- [ ] Pagination or infinite scroll

### Phase 6: Navigation
- [ ] Bottom tab bar (mobile-first): Roll, Menu, History, Stats, Feed
- [ ] Icons: dice, list, clock, chart, users
- [ ] Active tab indicator with neon accent
- [ ] Top bar: user avatar/gear icon → settings/profile
- [ ] Settings page: toggle public/private status

### Phase 7: Admin Features
- [ ] `/admin` route (admin-only, guarded)
- [ ] View all registered users (username, email)
- [ ] Toggle admin status for any user
- [ ] View any user's roll history
- [ ] App-wide aggregate stats

### Phase 8: Animations & Celebrations
- [ ] Doubles confetti animation (neon colors, "DOUBLES!" callout)
- [ ] Doubles bonus display: "You also get: Old Time Lager + Tullamore Dew shot!"
- [ ] Malort bottle celebration: bottles rising from bottom with wobble + neon-green glow
- [ ] "MALORT. You asked for it." text callout with gritty styling
- [ ] Stacking: double-6s triggers both Malort + doubles celebrations simultaneously
- [ ] Die selection animation (satisfying feedback on number pick)

### Phase 9: Social Features Polish
- [ ] Like/unlike API with optimistic UI
- [ ] Feed real-time updates (or pull-to-refresh)
- [ ] Share-to-feed prompt after saving a roll

### Phase 10: Backlog & Deferred Features
- [ ] Create `backlog.md` with deferred features:
  - Drink logo auto-lookup (Google Custom Search / Clearbit API)
  - Push notifications for doubles streaks
  - "Roll of the day" highlight on feed
  - Photo attachments to rolls
  - POS integration
  - Achievement badges
  - Malort celebration admin configurability (tie to menu slot, not hardcoded)

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://gqiolrxlaausuwehmotw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#0D0D0D` | Page background |
| Surface | `#1A1A1A` | Cards, modals |
| Primary Accent | `#FF2D55` | Neon pink/red, red die |
| Secondary Accent | `#FFD600` | Gold/amber, doubles highlights |
| Text Primary | `#F5F5F5` | Main text, white die |
| Text Secondary | `#999999` | Muted labels |
| Success/Doubles | `#00FF88` | Electric green, doubles celebration |

## Success Criteria

- [ ] User can sign up, log in, and see daily Mickey's puzzle
- [ ] User can enter a dice roll and see corresponding drinks with correct menu lookup
- [ ] User can view complete roll history
- [ ] User can explore personal stats with attractive visualizations
- [ ] User can browse social feed and like other users' rolls
- [ ] Admin can edit drink menu with manually uploaded logos
