#!/usr/bin/env bash
# Drives the installed CogVest e2e app with raw adb input (no Maestro hierarchy
# dumps) and writes device-uptime marks, so probe windows can be attributed with
# scripts/attribute-probe-windows.mjs. Tap coordinates default to a 1280x2856,
# density 480 display with the scale fixture; see
# docs/testing/2026-11-01-v3-performance-rerun.md.
#
# Override the positions for another display or fixture layout (#843). For
# example, the real-shaped fixture's Progress range chips sit at RANGE_Y=1849 on
# that display. Set ANDROID_SERIAL to pin a device when several are attached.
set -u
P=com.abdulshaikh.cogvest.e2e
OUT="$1"
TAB_Y="${TAB_Y:-2733}"
read -r -a TAB_X <<< "${TAB_X:-128 384 640}"
RANGE_Y="${RANGE_Y:-1398}"
read -r -a RANGE_X <<< "${RANGE_X:-177 400 624 847}"
SWIPE_X="${SWIPE_X:-640}"
LIST_TOP="${LIST_TOP:-1100}"
LIST_BOTTOM="${LIST_BOTTOM:-2200}"
PAGE_TOP="${PAGE_TOP:-900}"
PAGE_BOTTOM="${PAGE_BOTTOM:-2400}"
up() { adb shell cat /proc/uptime | awk '{print $1}'; }
# /proc/uptime counts time asleep and logcat -v monotonic does not, so on a
# phone that has slept they differ (#843). Marks are written on logcat's clock.
offset() {
  local uptime monotonic
  uptime=$(adb shell 'cat /proc/uptime; log -t cogvest-stall-mark offset' | awk 'NR==1{print $1}')
  monotonic=$(adb logcat -d -v monotonic -s cogvest-stall-mark 2>/dev/null | grep offset | tail -1 | awk '{print $1}')
  awk -v u="$uptime" -v m="${monotonic:-$uptime}" 'BEGIN{printf "%.3f", u-m}'
}
CLOCK_OFFSET="$(offset)"
mark() { echo "$(up | awk -v o="$CLOCK_OFFSET" '{printf "%.3f", $1-o}') $1" >> "$OUT"; }
tap() { adb shell input tap "$1" "$2"; }
swipes() { for _ in 1 2 3 4 5 6; do adb shell input swipe "$SWIPE_X" "$1" "$SWIPE_X" "$2" 450; sleep 0.35; done; }
idle() { sleep 11; }
dashboard() { tap "${TAB_X[0]}" "$TAB_Y"; }
holdings() { tap "${TAB_X[1]}" "$TAB_Y"; }
progress() { tap "${TAB_X[2]}" "$TAB_Y"; }

: > "$OUT"
adb shell am force-stop $P
adb shell monkey -p $P -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 15
for pass in 1 2; do
  mark "p$pass idle"; idle
  mark "p$pass tab-holdings"; holdings; idle
  mark "p$pass holdings-scroll-down"; swipes "$LIST_BOTTOM" "$LIST_TOP"; idle
  mark "p$pass holdings-scroll-up"; swipes "$LIST_TOP" "$LIST_BOTTOM"; idle
  mark "p$pass tab-progress"; progress; idle
  mark "p$pass progress-to-top"; for _ in 1 2 3 4 5; do adb shell input swipe "$SWIPE_X" "$PAGE_TOP" "$SWIPE_X" "$PAGE_BOTTOM" 250; done; idle
  mark "p$pass range-3M"; tap "${RANGE_X[0]}" "$RANGE_Y"; idle
  mark "p$pass range-6M"; tap "${RANGE_X[1]}" "$RANGE_Y"; idle
  mark "p$pass range-1Y"; tap "${RANGE_X[2]}" "$RANGE_Y"; idle
  mark "p$pass range-All"; tap "${RANGE_X[3]}" "$RANGE_Y"; idle
  mark "p$pass tab-dashboard"; dashboard; idle
  mark "p$pass tab-holdings-revisit"; holdings; idle
  mark "p$pass tab-progress-revisit"; progress; idle
  mark "p$pass tab-dashboard-revisit"; dashboard; idle
done
mark "end"
