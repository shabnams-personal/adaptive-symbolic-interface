#!/usr/bin/env bash
# deploy-update.sh — Run on the GCP VM as the "asi" user after pushing changes to git.
#
# Usage:
#   ssh into the VM, then:
#     ~/asi-prototype/scripts/deploy-update.sh
#
# Or run directly from your machine:
#   gcloud compute ssh asi-prototype --zone=YOUR_ZONE \
#     --command "sudo su - asi -c '~/asi-prototype/scripts/deploy-update.sh'"
#
# Environment variables (optional overrides):
#   APP_DIR  — path to the repo (default: ~/asi-prototype)
#   BRANCH   — branch to pull (default: develop)

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/asi-prototype}"
BRANCH="${BRANCH:-develop}"

echo ""
echo "=========================================="
echo "  ASI Deploy Update"
echo "  Branch : $BRANCH"
echo "  App dir: $APP_DIR"
echo "=========================================="
echo ""

# ── 1. Pull latest code ───────────────────────────────────────────────────────
echo "==> [1/5] Pulling latest code from $BRANCH..."
cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# ── 2. Frontend build ─────────────────────────────────────────────────────────
echo ""
echo "==> [2/5] Building frontend..."
cd "$APP_DIR/frontend"
npm install --silent
npm run build

# ── 3. Backend dependencies + migrations ─────────────────────────────────────
echo ""
echo "==> [3/5] Installing backend dependencies..."
cd "$APP_DIR/backend"
source venv/bin/activate
pip install -r requirements.txt --quiet

echo ""
echo "==> [4/5] Running database migrations..."
alembic upgrade head
deactivate

# ── 4. Restart backend service ────────────────────────────────────────────────
echo ""
echo "==> [5/5] Restarting backend service..."
sudo systemctl restart asi-backend

sleep 2
sudo systemctl status asi-backend --no-pager --lines=5

# ── 5. Quick health check ─────────────────────────────────────────────────────
echo ""
echo "==> Health check..."
if curl -sf http://127.0.0.1:8000/health > /dev/null; then
    echo "    Backend OK"
else
    echo "    WARNING: Backend health check failed — check logs:"
    echo "    sudo journalctl -u asi-backend -n 50"
fi

echo ""
echo "=========================================="
echo "  Deploy complete."
echo "=========================================="
echo ""
