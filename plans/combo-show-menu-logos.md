---
planStatus:
  planId: plan-combo-show-menu-logos
  title: Show Menu Item Photos in Tonight's Combo
  status: draft
  planType: bug-fix
  priority: medium
  owner: travis
  stakeholders: []
  tags: ["dice-roll", "ui", "images"]
  created: "2026-03-19"
  updated: "2026-03-19T00:00:00.000Z"
  progress: 0
---

# Show Menu Item Photos in Tonight's Combo

## Problem

On the Dice Roll page (`/roll`), when a user selects die numbers, the **Tonight's Combo** section shows the **die number** in the square above each drink name — even when the menu item has a photo/logo saved.

## Root Cause Analysis

### Current Code (already partially correct)

In `src/app/(app)/roll/page.tsx`, the `DrinkCard` component (lines 241–248) already has the correct conditional logic:

```jsx
{drink.logo ? (
  <img src={drink.logo} alt={drink.name} className="w-12 h-12 object-contain rounded-lg" />
) : (
  <span className={`font-display text-2xl ${isRed ? "text-neon-pink" : "text-text-primary"}`}>
    {dieNum}
  </span>
)}
```

This shows an image if `drink.logo` is truthy, otherwise falls back to the die number.

### Why Numbers Are Showing

**The code is functionally correct** — images display when `logo_url` is a valid, non-null string. Numbers appear in these cases:

1. **`logo_url` is `null` in the database** — the menu item has no uploaded logo yet
2. **Image loads but fails silently** — URL is stored but resource is missing/broken; however this would show a broken image icon, not a number, so this is less likely
3. **`logo_url` is an empty string `""`** — falsy, so falls through to number

The most likely cause: most/all menu items have `logo_url = null` because logos haven't been uploaded via the Menu admin page yet.

## The Fix

The code already handles logos correctly. However, there's one UX gap: **if an image URL is stored but fails to load** (broken link, storage issue), users would see a broken image icon rather than gracefully falling back to the die number. Adding an `onError` handler closes this gap.

### Changes Needed

**File: `src/app/(app)/roll/page.tsx`**

In the `DrinkCard` component, add an `onError` handler to the `<img>` element so that if the image fails to load, it falls back to showing the die number:

**Current code (lines 241–248):**
```jsx
{drink.logo ? (
  <img src={drink.logo} alt={drink.name} className="w-12 h-12 object-contain rounded-lg" />
) : (
  <span className={`font-display text-2xl ${isRed ? "text-neon-pink" : "text-text-primary"}`}>
    {dieNum}
  </span>
)}
```

**Approach — use local state to track image load failure:**

Convert `DrinkCard` to track whether the logo failed to load. If it fails, render the die number fallback instead.

```tsx
function DrinkCard({ drink, dieColor, dieNum }) {
  const [imgError, setImgError] = useState(false);
  const isRed = dieColor === "red";
  const showLogo = drink.logo && !imgError;

  return (
    <div className="flex flex-col items-center gap-2 flex-1 px-2">
      <div className={`w-16 h-16 rounded-xl flex items-center justify-center border-2 ${...}`}>
        {showLogo ? (
          <img
            src={drink.logo}
            alt={drink.name}
            className="w-12 h-12 object-contain rounded-lg"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={`font-display text-2xl ${isRed ? "text-neon-pink" : "text-text-primary"}`}>
            {dieNum}
          </span>
        )}
      </div>
      ...
    </div>
  );
}
```

This also requires adding `useState` import to `DrinkCard` (it's a separate function, currently doesn't use hooks — it's a plain function component, so this is safe to add).

## Implementation Steps

1. **Add `useState` to `DrinkCard`** — add local `imgError` state
2. **Add `onError` to `<img>`** — `onError={() => setImgError(true)}`
3. **Change condition** — `drink.logo && !imgError` instead of just `drink.logo`
4. **Reset `imgError` on prop change** — add a `useEffect` to reset when `drink.logo` changes (handles case where user navigates to a different die number)

## Scope

- **One file changed:** `src/app/(app)/roll/page.tsx`
- **No database changes required**
- **No new dependencies**
- **Minimal surface area** — only `DrinkCard` function is modified

## Notes

- If logos are still not showing after this fix, the issue is the `logo_url` being null in the database (no logos uploaded via Menu admin). That's a data issue, not a code issue.
- The fix improves resilience regardless — handles current broken-URL case and future-proofs the component.
