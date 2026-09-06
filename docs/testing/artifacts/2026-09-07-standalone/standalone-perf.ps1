$ErrorActionPreference = 'Stop'
$package = 'com.abdulshaikh.cogvest'
# Positions captured from the settled Pixel_10_Pro UI hierarchy, 1280x2856.
# Run only after the standalone custom-range flow leaves Portfolio Growth visible.
for ($run = 1; $run -le 3; $run++) {
    adb shell dumpsys gfxinfo $package reset | Out-Null
    foreach ($x in @(202, 413, 624, 835, 202, 413, 624, 835, 202, 413, 624, 835)) {
        adb shell input tap $x 1494
        Start-Sleep -Milliseconds 700
    }
    adb shell dumpsys gfxinfo $package framestats > ".expo/standalone-range-$run.txt"
}
for ($run = 1; $run -le 3; $run++) {
    adb shell dumpsys gfxinfo $package reset | Out-Null
    for ($pair = 0; $pair -lt 6; $pair++) {
        adb shell input swipe 640 2200 640 1100 450
        Start-Sleep -Milliseconds 350
        adb shell input swipe 640 1100 640 2200 450
        Start-Sleep -Milliseconds 350
    }
    adb shell dumpsys gfxinfo $package framestats > ".expo/standalone-scroll-$run.txt"
}
adb shell dumpsys meminfo $package > .expo/standalone-memory.txt
for ($run = 1; $run -le 3; $run++) {
    adb shell am start -W -S -n "$package/.MainActivity" > ".expo/standalone-start-$run.txt"
    Start-Sleep -Seconds 3
}
adb shell dumpsys activity exit-info $package > .expo/standalone-exits.txt
Write-Output 'Performance samples captured. Inspect raw output before interpreting.'
