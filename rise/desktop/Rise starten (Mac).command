#!/bin/bash
# Startet Rise als eigenes App-Fenster und verhindert, dass der Mac einschläft.
DIR="$(cd "$(dirname "$0")" && pwd)"
URL="file://$DIR/Rise.html"
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$URL" --autoplay-policy=no-user-gesture-required
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$URL" --autoplay-policy=no-user-gesture-required
else
  open "$DIR/Rise.html"
fi
echo "Rise läuft. Lass dieses Fenster offen: Solange es offen ist, schläft der Mac nicht ein."
echo "Zum Beenden: dieses Fenster schließen."
caffeinate -dims
