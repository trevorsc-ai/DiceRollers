#!/usr/bin/env bash
# scripts/deploy/prepush.sh
# Phase 3: Pre-PR gates. All must pass before opening a PR.
# READ-ONLY on remote — only local build artifacts are touched.
#
# Usage: ./scripts/deploy/prepush.sh [--skip-types]
#
# Flags:
#   --skip-types   Skip type regeneration (use when schema hasn't changed)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

SKIP_TYPES=false
for arg in "$@"; do
  case $arg in
    --skip-types) SKIP_TYPES=true ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  DiceRollers — Phase 3: Pre-PR Gates     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 0. Ensure .env.local exists (build needs Supabase URL/keys) ───────────────
if [ ! -f ".env.local" ]; then
  echo "▶ .env.local missing — pulling from Vercel..."
  vercel env pull .env.local
  echo "  ✅ .env.local pulled"
  echo ""
fi

# ── 1. Regenerate Supabase types ───────────────────────────────────────────────
if [ "$SKIP_TYPES" = false ]; then
  echo "▶ Regenerating Supabase TypeScript types..."
  npx supabase gen types typescript --linked > src/types/database.ts
  echo "  ✅ src/types/database.ts updated"
else
  echo "  ⏭  Skipping type regen (--skip-types)"
fi

echo ""

# ── 2. TypeScript check ────────────────────────────────────────────────────────
echo "▶ Running tsc --noEmit..."
npx tsc --noEmit
echo "  ✅ TypeScript: clean"

echo ""

# ── 3. Lint ────────────────────────────────────────────────────────────────────
echo "▶ Running next lint..."
npx next lint
echo "  ✅ Lint: clean"

echo ""

# ── 4. Production build ────────────────────────────────────────────────────────
echo "▶ Running next build..."
npx next build
echo "  ✅ Build: success"

echo ""
echo "✅ All pre-PR gates passed. Ready to push and open PR."
echo ""
