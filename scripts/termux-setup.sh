#!/bin/bash
set -e

echo "=== BlitzPay Free Transfer - Termux Setup ==="
echo "This installs the tools needed to push the Apps Script code."
echo ""

read -p "Press Enter to continue..."

echo ""
echo "[1/3] Updating Termux packages..."
pkg update -y

echo ""
echo "[2/3] Installing Node.js..."
pkg install -y nodejs

echo ""
echo "[3/3] Installing clasp (Google Apps Script CLI)..."
npm install -g @google/clasp

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next step: run ./termux-deploy.sh"
