#!/bin/bash
# ─────────────────────────────────────────────
# NGL Paper — Start Everything
# Jalankan: bash start.sh
# ─────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🧹 Cleaning up old processes..."
kill $(lsof -t -i:5173) 2>/dev/null
kill $(lsof -t -i:3001) 2>/dev/null
pkill -f cloudflared 2>/dev/null
sleep 1

echo "🚀 Starting Vite frontend (port 5173)..."
npm run dev -- --host > /tmp/vite-ngl.log 2>&1 &
sleep 3

echo "🤖 Starting AI backend (port 3001)..."
cd "$SCRIPT_DIR/backend" && node server.js > /tmp/backend-ngl.log 2>&1 &
cd "$SCRIPT_DIR"
sleep 2

echo "🌐 Starting Cloudflare tunnel for frontend..."
cloudflared tunnel --url http://localhost:5173 > /tmp/cf-ngl.log 2>&1 &
sleep 2

echo "🌐 Starting Cloudflare tunnel for backend..."
cloudflared tunnel --url http://localhost:3001 > /tmp/cf-backend-ngl.log 2>&1 &
sleep 8

FRONTEND_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-ngl.log | head -1)
BACKEND_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-backend-ngl.log | head -1)

# Inject backend URL into index.html so React can access it from any device
if [ -n "$BACKEND_URL" ]; then
  # Remove any previous injection, then inject fresh
  sed -i 's|<script id="ngl-config">.*</script>||g' "$SCRIPT_DIR/index.html"
  sed -i "s|</head>|  <script id=\"ngl-config\">window.__BACKEND_URL__ = '${BACKEND_URL}';<\/script>\n  </head>|" "$SCRIPT_DIR/index.html"
  echo "✅ Backend URL injected: $BACKEND_URL"
else
  echo "⚠️  Could not get backend tunnel URL — falling back to localhost"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ NGL Paper — All systems running!"
echo ""
echo "  📱 MiniPay URL (Frontend):"
echo "  $FRONTEND_URL"
echo ""
echo "  🔗 Backend Tunnel URL:"
echo "  $BACKEND_URL"
echo ""
echo "  💻 Frontend : http://localhost:5173"
echo "  🤖 Backend  : http://localhost:3001"
echo "  🏥 Health   : http://localhost:3001/api/health"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Cara buka di MiniPay:"
echo "  1. Settings → Developer Settings"
echo "  2. Load Test Page"
echo "  3. Paste URL di atas → Go"
echo "═══════════════════════════════════════════════"
echo ""
echo "  (Tekan Ctrl+C untuk stop semua)"

# Restore index.html on exit
cleanup() {
  echo ""
  echo "🧹 Restoring index.html..."
  sed -i 's|<script id="ngl-config">.*</script>||g' "$SCRIPT_DIR/index.html"
  echo "Done."
}
trap cleanup EXIT

wait
