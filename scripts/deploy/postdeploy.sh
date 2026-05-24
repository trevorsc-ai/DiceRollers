#!/usr/bin/env bash
# scripts/deploy/postdeploy.sh
# Phase 5: Verify production is healthy after Vercel deploy.
# READ-ONLY — only hits external URLs, no local side effects.
#
# Usage: ./scripts/deploy/postdeploy.sh [--timeout 300]

set -euo pipefail

PROD_URL="https://diceroll.today"
MAX_WAIT=300  # seconds to wait for READY
ELAPSED=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --timeout) MAX_WAIT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  DiceRollers — Phase 5: Post-Deploy      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Wait for Vercel production deployment to be READY ──────────────────────
echo "▶ Waiting for production deployment to reach READY state..."

while [ $ELAPSED -lt $MAX_WAIT ]; do
  DEPLOY_STATE=$(vercel ls --prod --limit 1 2>/dev/null | awk 'NR==3 {print $3}' || echo "unknown")

  if [ "$DEPLOY_STATE" = "READY" ]; then
    echo "  ✅ Production deployment: READY"
    break
  elif [ "$DEPLOY_STATE" = "ERROR" ]; then
    echo ""
    echo "❌ Production deployment failed (state: ERROR)"
    echo ""
    echo "   Run: vercel logs --prod"
    echo "   Do NOT auto-rollback. Surface this and wait for decision."
    exit 1
  else
    echo "  ⏳ Deployment state: $DEPLOY_STATE (${ELAPSED}s elapsed)..."
  fi

  sleep 15
  ELAPSED=$((ELAPSED + 15))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "  ⚠️  Timed out waiting for READY — checking URL anyway"
fi

echo ""

# ── 2. Curl production root ────────────────────────────────────────────────────
echo "▶ Checking production root..."
ROOT_STATUS=$(curl -sI --max-time 10 "$PROD_URL" | head -1 | awk '{print $2}' || echo "0")

if [[ "$ROOT_STATUS" =~ ^(200|301|302|307|308)$ ]]; then
  echo "  ✅ Root: $ROOT_STATUS"
else
  echo "  ❌ Root returned: $ROOT_STATUS"
  FAILED=true
fi

echo ""

# ── 3. Curl /api/health ────────────────────────────────────────────────────────
echo "▶ Checking /api/health..."
HEALTH_RESPONSE=$(curl -s --max-time 10 "$PROD_URL/api/health" || echo '{"ok":false,"error":"curl failed"}')
echo "  Response: $HEALTH_RESPONSE"

HEALTH_OK=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('ok') else 'no')" 2>/dev/null || echo "no")

if [ "$HEALTH_OK" = "yes" ]; then
  echo "  ✅ Health: ok"
else
  echo "  ❌ Health check failed"
  FAILED=true
fi

echo ""

# ── Result ─────────────────────────────────────────────────────────────────────
if [ "${FAILED:-false}" = "true" ]; then
  echo "❌ Post-deploy verification FAILED."
  echo ""
  echo "   Next steps:"
  echo "   1. Check Vercel logs: vercel logs --prod"
  echo "   2. Check Supabase dashboard for DB issues"
  echo "   3. Decide: rollback via 'vercel rollback' or hotfix"
  echo "   4. Do NOT auto-rollback — await decision"
  exit 1
fi

echo "✅ Production is healthy."
echo ""
