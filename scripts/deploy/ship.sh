#!/usr/bin/env bash
# scripts/deploy/ship.sh
# Full orchestrator — runs all 5 phases in sequence.
# This is the single entry point Claude calls for any change.
#
# Usage: ./scripts/deploy/ship.sh [options]
#
# Options:
#   --auto-confirm        Skip confirmation prompts in migrate.sh and merge.sh
#   --skip-types          Skip Supabase type regen in prepush.sh (no schema change)
#   --skip-migrate        Skip Phase 4a (migration-only if no SQL changed)
#   --pr-title "..."      PR title for merge.sh
#   --pr-body "..."       PR body for merge.sh
#
# Examples:
#   ./scripts/deploy/ship.sh                           # interactive, all phases
#   ./scripts/deploy/ship.sh --auto-confirm            # non-interactive (trusted mode)
#   ./scripts/deploy/ship.sh --skip-migrate --skip-types  # code-only change

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Parse args — pass-through to sub-scripts
AUTO_CONFIRM=""
SKIP_TYPES=""
SKIP_MIGRATE=false
PR_TITLE_ARG=""
PR_BODY_ARG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --auto-confirm) AUTO_CONFIRM="--auto-confirm"; shift ;;
    --skip-types) SKIP_TYPES="--skip-types"; shift ;;
    --skip-migrate) SKIP_MIGRATE=true; shift ;;
    --pr-title) PR_TITLE_ARG="--pr-title $2"; shift 2 ;;
    --pr-body) PR_BODY_ARG="--pr-body $2"; shift 2 ;;
    *) shift ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      DiceRollers — ship.sh               ║"
echo "║      Full Deploy Orchestrator            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

START_TIME=$(date +%s)

# ── Phase 1: Preflight ─────────────────────────────────────────────────────────
echo "━━━ Phase 1/5: Preflight ━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/preflight.sh"

# ── Phase 3: Pre-PR Gates ──────────────────────────────────────────────────────
# (Phase 2 is the development work itself — done before calling ship.sh)
echo "━━━ Phase 3/5: Pre-PR Gates ━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/prepush.sh" $SKIP_TYPES

# ── Phase 4a: Migrate ──────────────────────────────────────────────────────────
if [ "$SKIP_MIGRATE" = false ]; then
  echo "━━━ Phase 4a/5: Migrate ━━━━━━━━━━━━━━━━━━━━"
  bash "$SCRIPT_DIR/migrate.sh" $AUTO_CONFIRM
else
  echo "━━━ Phase 4a/5: Migrate (skipped) ━━━━━━━━━━"
fi

# ── Phase 4b–d: Push + Preview Gate + Merge ───────────────────────────────────
echo "━━━ Phase 4b–d/5: Merge ━━━━━━━━━━━━━━━━━━━━"
# shellcheck disable=SC2086
bash "$SCRIPT_DIR/merge.sh" $AUTO_CONFIRM $PR_TITLE_ARG $PR_BODY_ARG

# ── Phase 5: Post-Deploy Verification ─────────────────────────────────────────
echo "━━━ Phase 5/5: Post-Deploy ━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/postdeploy.sh"

# ── Summary ────────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS_REM=$((ELAPSED % 60))

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ SHIP COMPLETE                        ║"
echo "║  Total time: ${MINUTES}m ${SECONDS_REM}s"
echo "╚══════════════════════════════════════════╝"
echo ""
