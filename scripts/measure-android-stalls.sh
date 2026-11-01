#!/usr/bin/env bash
# Drives the installed CogVest e2e app with raw adb input (no Maestro hierarchy
# dumps) and writes device-uptime marks, so probe windows can be attributed with
# scripts/attribute-probe-windows.mjs. Tap coordinates assume a 1280x2856,
# density 480 display with the scale fixture; see
# docs/testing/2026-11-01-v3-performance-rerun.md.
set -u
P=com.abdulshaikh.cogvest.e2e
OUT="$1"
up() { adb shell cat /proc/uptime | awk '{print $1}'; }
mark() { echo "$(up) $1" >> "$OUT"; }
tap() { adb shell input tap "$1" "$2"; }
swipes() { for _ in 1 2 3 4 5 6; do adb shell input swipe 640 "$1" 640 "$2" 450; sleep 0.35; done; }
idle() { sleep 11; }

: > "$OUT"
adb shell am force-stop $P
adb shell monkey -p $P -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 15
for pass in 1 2; do
  mark "p$pass idle"; idle
  mark "p$pass tab-holdings"; tap 384 2733; idle
  mark "p$pass holdings-scroll-down"; swipes 2200 1100; idle
  mark "p$pass holdings-scroll-up"; swipes 1100 2200; idle
  mark "p$pass tab-progress"; tap 640 2733; idle
  mark "p$pass progress-to-top"; for _ in 1 2 3 4 5; do adb shell input swipe 640 900 640 2400 250; done; idle
  mark "p$pass range-3M"; tap 177 1398; idle
  mark "p$pass range-6M"; tap 400 1398; idle
  mark "p$pass range-1Y"; tap 624 1398; idle
  mark "p$pass range-All"; tap 847 1398; idle
  mark "p$pass tab-dashboard"; tap 128 2733; idle
  mark "p$pass tab-holdings-revisit"; tap 384 2733; idle
  mark "p$pass tab-progress-revisit"; tap 640 2733; idle
  mark "p$pass tab-dashboard-revisit"; tap 128 2733; idle
done
mark "end"
