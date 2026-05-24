#!/usr/bin/env bash
# scripts/deploy/merge.sh
# Phase 4b–4d: Push branch, open PR, wait for preview gate, squash-merge.
# DESTRUCTIVE — merges to main, triggering Vercel auto-deploy.
#
# Usage: ./scripts/deploy/merge.sh [--auto-confirm] [--pr-title "title"] [--pr-body "body"]
#
# Flags:
#   --auto-confirm     Skip the merge confirmation prompt
#   --pr-title "..."   PR title (defaults to last commit message)
#   --pr-body "..."    PR body (defaults to empty)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

AUTO_CONFIRM=false
PR_TITLE=""
PR_BODY="🤖 Generated with [Claude Code](https://claude.com/claude-code)"

while [[ $# -gt 0 ]]; do
  case $1 in
    --auto-confirm) AUTO_CONFIRM=true; shift ;;
    --pr-title) PR_TITLE="$2"; shift 2 ;;
    --pr-body) PR_BODY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "❌ Already on main — run this from a feature branch."
  exit 1
fi

if [ -z "$PR_TITLE" ]; then
  PR_TITLE=$(git log --oneline -1 --format="%s")
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  DiceRollers — Phase 4b–d: Merge         ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Branch:   $CURRENT_BRANCH"
echo "  PR title: $PR_TITLE"
echo ""

# ── 4b. Push branch ────────────────────────────────────────────────────────────
echo "▶ Pushing branch to origin..."
git push origin "$CURRENT_BRANCH"
echo "  ✅ Branch pushed"

echo ""

# ── 4c. Open PR ────────────────────────────────────────────────────────────────
echo "▶ Creating PR..."
PR_URL=$(gh pr create \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  --base main \
  --head "$CURRENT_BRANCH" 2>&1)
echo "  ✅ PR created: $PR_URL"
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')

echo ""

# ── 4c. Wait for preview deployment ───────────────────────────────────────────
echo "▶ Waiting for Vercel preview deployment..."
MAX_WAIT=300  # 5 minutes
ELAPSED=0
PREVIEW_URL=""

while [ $ELAPSED -lt $MAX_WAIT ]; do
  PREVIEW_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url' 2>/dev/null || true)

  # Try to get preview URL from Vercel via gh pr checks
  CHECKS=$(gh pr checks "$PR_NUMBER" 2>/dev/null || true)
  VERCEL_URL=$(echo "$CHECKS" | grep -i "vercel" | grep -oE 'https://[^ ]+' | head -1 || true)

  if [ -n "$VERCEL_URL" ]; then
    PREVIEW_URL="$VERCEL_URL"
    echo "  Preview URL: $PREVIEW_URL"

    # Check if preview returns 200/3xx
    HTTP_STATUS=$(curl -sI --max-time 10 "$PREVIEW_URL" | head -1 | awk '{print $2}' || echo "0")
    if [[ "$HTTP_STATUS" =~ ^(200|301|302|307|308)$ ]]; then
      echo "  ✅ Preview responding ($HTTP_STATUS)"
      break
    else
      echo "  ⏳ Preview not ready yet (status: $HTTP_STATUS)..."
    fi
  else
    echo "  ⏳ Waiting for preview URL... (${ELAPSED}s)"
  fi

  sleep 15
  ELAPSED=$((ELAPSED + 15))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "  ⚠️  Preview timed out — proceeding anyway (check Vercel dashboard)"
fi

# Also check health endpoint on preview if we have the URL
if [ -n "$PREVIEW_URL" ]; then
  HEALTH=$(curl -s --max-time 10 "${PREVIEW_URL}/api/health" 2>/dev/null || echo '{"ok":false}')
  echo "  Health: $HEALTH"
fi

echo ""

# ── 4d. Squash-merge ──────────────────────────────────────────────────────────
if [ "$AUTO_CONFIRM" = false ]; then
  read -r -p "Squash-merge PR #$PR_NUMBER to main? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted. PR is open: $PR_URL"
    exit 1
  fi
fi

echo "▶ Squash-merging PR #$PR_NUMBER..."
gh pr merge "$PR_NUMBER" --squash --delete-branch
echo ""
echo "✅ Merged to main. Vercel auto-deploy triggered."
echo ""
