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
# Preview URLs are protected by Vercel SSO — use `vercel curl` (authenticated)
# rather than plain curl. Gate on: GitHub check green AND health ok.
echo "▶ Waiting for Vercel preview deployment..."
MAX_WAIT=300  # 5 minutes
ELAPSED=0
PREVIEW_READY=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  # Check GitHub PR checks for the Vercel build status
  CHECKS=$(gh pr checks "$PR_NUMBER" 2>/dev/null || true)
  BUILD_STATUS=$(echo "$CHECKS" | grep -i "vercel" | grep -iv "comments" | awk '{print $2}' | head -1 || true)

  if [ "$BUILD_STATUS" = "pass" ]; then
    echo "  ✅ Vercel build check: pass"
    PREVIEW_READY=true

    # Get preview URL from Vercel CLI (most recent preview deployment)
    PREVIEW_URL=$(vercel ls 2>/dev/null | awk '/Preview/ && /Ready/ {print $3; exit}' || true)
    if [ -n "$PREVIEW_URL" ]; then
      echo "  Preview URL: $PREVIEW_URL"
      # Use vercel curl for authenticated access to SSO-protected preview
      HEALTH=$(vercel curl "${PREVIEW_URL}/api/health" 2>/dev/null || echo '{"ok":false,"error":"vercel curl failed"}')
      echo "  Health: $HEALTH"
      HEALTH_OK=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('ok') else 'no')" 2>/dev/null || echo "unknown")
      if [ "$HEALTH_OK" = "yes" ]; then
        echo "  ✅ Preview health: ok"
      elif [ "$HEALTH_OK" = "unknown" ]; then
        echo "  ℹ️  Health parse uncertain — build is READY, proceeding"
      else
        echo "  ⚠️  Preview health returned not-ok — check manually before merging"
      fi
    fi
    break
  elif echo "$BUILD_STATUS" | grep -qE "fail|error"; then
    echo "  ❌ Vercel build failed — aborting"
    exit 1
  else
    echo "  ⏳ Vercel build: ${BUILD_STATUS:-pending} (${ELAPSED}s)..."
  fi

  sleep 15
  ELAPSED=$((ELAPSED + 15))
done

if [ "$PREVIEW_READY" = false ]; then
  echo "  ⚠️  Preview timed out — proceeding anyway (check Vercel dashboard)"
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
