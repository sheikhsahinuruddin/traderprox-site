#!/bin/sh
# Run on your PC/Termux:  RAILKIT_KEY=your_key sh test-railkit.sh
# Prints only status/headers/first 200 chars. Never prints the key.
D=$(date +%d-%m-%Y)
for BASE in https://railkit.in https://api.railkit.in; do
 for H in x-api-key Authorization; do
  V="$RAILKIT_KEY"; [ "$H" = Authorization ] && V="Bearer $RAILKIT_KEY"
  echo "== $BASE  header=$H"
  curl -s -m 15 -D /tmp/rk.h -o /tmp/rk.b -H "Origin: https://traderprox.site" -H "$H: $V" "$BASE/api/v1/trains/12301/live/$D"
  head -1 /tmp/rk.h; grep -i '^access-control' /tmp/rk.h || echo "(no CORS headers)"
  head -c 200 /tmp/rk.b; echo
 done
done
