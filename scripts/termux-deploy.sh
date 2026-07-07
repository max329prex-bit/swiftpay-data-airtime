#!/bin/bash
set -e

PROJECT_DIR="$HOME/blitzpay-apps-script"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Clean any previous attempt
rm -f Code.gs

echo "=== BlitzPay Free Transfer - Deploy Apps Script ==="
echo ""

echo "[1/4] Downloading Apps Script code..."
curl -fsSLO https://raw.githubusercontent.com/max329prex-bit/swiftpay-data-airtime/main/apps-script/Blitzpay.gs
curl -fsSLO https://raw.githubusercontent.com/max329prex-bit/swiftpay-data-airtime/main/apps-script/appsscript.json

echo ""
echo "[2/4] Creating Apps Script project..."
clasp create --type standalone --title "BlitzPay Free Transfer"

echo ""
echo "[3/4] Pushing code to Google Apps Script..."
clasp push

echo ""
echo "[4/4] Deploying as Web App..."
clasp deploy -V 1 -d "web app"

echo ""
echo "=== Done ==="
echo ""
echo "Your web app deployments:"
clasp deployments
echo ""
echo "Copy the URL above (the one that says 'web app') and paste it here."
