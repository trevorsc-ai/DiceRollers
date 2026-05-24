#!/usr/bin/env bash
# scripts/deploy/migrate.sh
# Phase 4a: Apply pending migrations to remote DB.
# DESTRUCTIVE — runs before code merge so schema is ready when code lands.
#
# Usage: ./scripts/deploy/migrate.sh [--auto-confirm]
#
# Flags:
#   --auto-confirm   Skip the confirmation prompt (use once workflow is trusted)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

AUTO_CONFIRM=false
for arg in "$@"; do
  case $arg in
    --auto-confirm) AUTO_CONFIRM=true ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  DiceRollers — Phase 4a: Migrate         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Show what's pending before applying
echo "▶ Current migration status:"
npx supabase migration list 2>&1
echo ""

# Check if there's anything to push
PENDING=$(npx supabase migration list 2>&1 | awk '
  /^[[:space:]]+[0-9]/ {
    split($0, cols, "|")
    local = cols[1]; gsub(/[[:space:]]/, "", local)
    remote = cols[2]; gsub(/[[:space:]]/, "", remote)
    if (local != "" && remote == "") print local
  }
')

if [ -z "$PENDING" ]; then
  echo "  ℹ️  No pending migrations — nothing to push."
  echo ""
  exit 0
fi

echo "⚠️  Pending migrations to apply to PRODUCTION:"
echo "$PENDING"
echo ""

# Confirmation gate (skip with --auto-confirm once workflow is stable)
if [ "$AUTO_CONFIRM" = false ]; then
  read -r -p "Apply these migrations to production? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "▶ Pushing migrations..."
npx supabase db push --linked
echo ""
echo "✅ Migrations applied. Schema is live on production."
echo ""
