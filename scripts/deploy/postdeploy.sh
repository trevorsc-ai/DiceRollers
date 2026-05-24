#!/usr/bin/env bash
# scripts/deploy/postdeploy.sh
# Phase 5: Verify production is healthy after Vercel deploy.
# READ-ONLY — only hits external URLs, no local side effects.
#
# Strategy: poll /api/health until ok:true (proves READY + DB up) rather than
# trying to parse `vercel ls` output, which is table-formatted only in TTY mode.
#
# Usage: ./scripts/deploy/postdeploy.sh [--timeout 300]

set -euo pipefail

# bare diceroll.today does a 307 → www; hit www directly
PROD_URL="https://www.diceroll.today"
MAX_WAIT=300  # seconds
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

# ── 1. Poll health endpoint until ok or timeout ────────────────────────────────
echo "▶ Polling $PROD_URL/api/health until healthy (max ${MAX_WAIT}s)..."

while [ $ELAPSED -lt $MAX_WAIT ]; do
  HEALTH=$(curl -s --max-time 10 "$PROD_URL/api/health" 2>/dev/null || echo '{"ok":false,"error":"curl failed"}')
  HEALTH_OK=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('ok') else 'no')" 2>/dev/null || echo "no")

  if [ "$HEALTH_OK" = "yes" ]; then
    COMMIT=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('commit','?'))" 2>/dev/null || echo "?")
    echo "  ✅ Healthy! Response: $HEALTH"
    break
  else
    echo "  ⏳ Not healthy yet (${ELAPSED}s): $HEALTH"
  fi

  sleep 15
  ELAPSED=$((ELAPSED + 15))
done

if [ $ELAPSED -ge $MAX_WAIT ] && [ "${HEALTH_OK:-no}" != "yes" ]; then
  echo ""
  echo "❌ Health check timed out after ${MAX_WAIT}s"
  echo "   Last response: $HEALTH"
  echo ""
  echo "   Next steps:"
  echo "   1. Check Vercel logs: vercel logs"
  echo "   2. Check Supabase dashboard for DB issues"
  echo "   3. Decide: rollback via 'vercel rollback' or hotfix"
  echo "   4. Do NOT auto-rollback — await decision"
  exit 1
fi

echo ""

# ── 2. Confirm root responds ────────────────────────────────────────────────────
echo "▶ Checking production root (www.diceroll.today)..."
ROOT_STATUS=$(curl -sI --max-time 10 "$PROD_URL" | head -1 | awk '{print $2}' || echo "0")

if [[ "$ROOT_STATUS" =~ ^(200|301|302|307|308)$ ]]; then
  echo "  ✅ Root: $ROOT_STATUS"
else
  echo "  ❌ Root returned: $ROOT_STATUS"
  echo ""
  echo "   Do NOT auto-rollback. Surface this and await decision."
  exit 1
fi

echo ""
echo "✅ Production is healthy. Commit: $(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('commit','?'))" 2>/dev/null || echo "?")"
echo ""
