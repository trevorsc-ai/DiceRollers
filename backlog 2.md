# Jackie Lee's Dice Roll Tracker — Backlog

Features deferred from V1. Prioritize after prototype validation.

---

## 🔍 Drink Logo Auto-Lookup

When an admin edits a drink name, automatically search for and suggest a logo image.

**Implementation options:**
- Google Custom Search API (needs Programmable Search Engine + API key)
- Bing Image Search API
- Clearbit Logo API (best for branded beverages)

**Flow:**
1. Admin enters drink name
2. Server-side Next.js API route queries search API for "[name] beer logo" or "[name] liquor logo"
3. Top result shown as preview — admin accepts, rejects, or uploads manually
4. Accepted image downloaded and stored in Supabase Storage

**Env var needed:** `IMAGE_SEARCH_API_KEY`

---

## 🔔 Push Notifications — Doubles Streak Alerts

Notify users (opt-in) when they're on a doubles streak or when friends roll doubles.

---

## ⭐ Roll of the Day Highlight

Feature one roll on the feed each day — most liked, most chaotic (double Malort?), etc.

---

## 📸 Photo Attachments

Let users snap a selfie with their drinks and attach it to a roll entry.

---

## 🏆 Achievement Badges

Unlock badges for milestones:
- First Roll
- 10th Roll, 50th Roll, 100th Roll
- First Doubles
- 10th Doubles
- Rolled every number 1-8 on each die
- Survived Malort (rolled white 6)
- Double Malort (red 6 + white 6)

---

## 🎯 Malort Celebration — Admin Configurable

Currently the Malort celebration is tied to white die slot 6 hardcoded.
In a future version, admins should be able to assign the celebration to any menu slot via the admin panel, so if Malort moves or is replaced it can be reassigned.

---

## 🔗 Jackie Lee's POS Integration

Pull actual order data from the bar's point-of-sale system to auto-verify rolls (stretch goal).

---

## 🌓 Light Mode

The app defaults to dark (correct). Light mode could be added as a toggle in Settings for daylight use.

---

## 📊 Advanced Stats

- Heat map calendar (GitHub-style) showing roll frequency over time
- Longest doubles streak ever
- Rarest drink (least rolled)
- Head-to-head comparison with friends

---

## 🎲 Dice Roll Simulator Mode

For when you're not at the bar — roll virtual dice and see what you would have gotten.
