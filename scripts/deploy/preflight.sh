#!/usr/bin/env bash
# scripts/deploy/preflight.sh
# Phase 1: Session-start preflight check.
# READ-ONLY — safe to run anytime. No destructive actions.
#
# Usage: ./scripts/deploy/preflight.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  DiceRollers — Phase 1: Preflight        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Sync with remote main ───────────────────────────────────────────────────
echo "▶ Pulling origin/main..."
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" = "main" ]; then
  git pull origin main
else
  # Fetch and fast-forward main without switching branches
  git fetch origin main:main
  echo "  (On branch '$CURRENT_BRANCH' — fetched main without switching)"
fi

# ── 2. Check migration drift ───────────────────────────────────────────────────
echo ""
echo "▶ Checking migration status..."
MIGRATION_OUTPUT=$(npx supabase migration list 2>&1)
echo "$MIGRATION_OUTPUT"

# Detect remote rows with no local file (drift indicator)
# supabase migration list columns: Local | Remote | Time (UTC)
# A drifted row has content in Remote but blank/absent in Local
DRIFT=$(echo "$MIGRATION_OUTPUT" | awk '
  /^[[:space:]]+[0-9]/ {
    split($0, cols, "|")
    local = cols[1]; gsub(/[[:space:]]/, "", local)
    remote = cols[2]; gsub(/[[:space:]]/, "", remote)
    if (remote != "" && local == "") print remote
  }
')

if [ -n "$DRIFT" ]; then
  echo ""
  echo "⚠️  DRIFT DETECTED — remote has versions with no local SQL file:"
  echo "$DRIFT"
  echo ""
  echo "   Run: supabase db pull"
  echo "   Then commit the generated file on a chore/capture-migration-NNN branch."
  echo "   Merge that drift-capture PR before starting feature work."
  echo ""
  exit 1
fi

echo ""
echo "✅ Preflight passed — no drift, main is synced."
echo ""
