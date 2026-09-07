param(
    [Parameter(Mandatory)][ValidateSet('ranges', 'scroll')][string]$Mode,
    [Parameter(Mandatory)][string]$Label,
    [ValidatePattern('^[a-zA-Z0-9_.]+$')][string]$Package = 'com.abdulshaikh.cogvest',
    [int[]]$RangeX = @(),
    [int]$RangeY = 0,
    [int]$ScrollX = 640,
    [int]$TopY = 1100,
    [int]$BottomY = 2200,
    [ValidateRange(1, 10)][int]$Runs = 3
)

$ErrorActionPreference = 'Stop'
if ($Label -notmatch '^[a-zA-Z0-9-]+$') { throw 'Use a simple alphanumeric sample label.' }
if ($Mode -eq 'ranges' -and ($RangeX.Count -ne 4 -or $RangeY -le 0)) {
    throw 'Supply four measured range-chip X coordinates and their positive Y coordinate.'
}
$output = Join-Path (Get-Location) ".expo/frame-probes/$Label"
New-Item -ItemType Directory -Force $output | Out-Null

function Invoke-Adb([string[]]$Arguments) {
    $result = & adb @Arguments
    if ($LASTEXITCODE -ne 0) { throw "adb failed: $($Arguments -join ' ')" }
    return $result
}

# Navigate and measure coordinates before running. Keep Maestro, builds and tests
# stopped during samples. This probe does not seed data or change display settings.
$foreground = Invoke-Adb @('shell', 'dumpsys', 'activity', 'activities')
if (-not ($foreground -match "(?:topResumedActivity=|mResumedActivity:|ResumedActivity:).*$([regex]::Escape($package))/")) {
    throw "$Package must be the foreground app before measuring."
}
@{ package = $Package; mode = $Mode; rangeX = $RangeX; rangeY = $RangeY; scrollX = $ScrollX;
   topY = $TopY; bottomY = $BottomY; runs = $Runs } |
    ConvertTo-Json | Out-File "$output/probe.json"
Invoke-Adb @('shell', 'wm', 'size') | Out-File "$output/display.txt"
Invoke-Adb @('shell', 'wm', 'density') | Out-File "$output/density.txt"
Invoke-Adb @('shell', 'settings', 'get', 'system', 'font_scale') | Out-File "$output/font.txt"
for ($run = 1; $run -le $Runs; $run++) {
    Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $package, 'reset') | Out-Null
    if ($Mode -eq 'ranges') {
        for ($cycle = 0; $cycle -lt 3; $cycle++) {
            foreach ($x in $RangeX) {
                Invoke-Adb @('shell', 'input', 'tap', "$x", "$RangeY") | Out-Null
                Start-Sleep -Milliseconds 700
            }
        }
    } else {
        for ($pair = 0; $pair -lt 6; $pair++) {
            Invoke-Adb @('shell', 'input', 'swipe', "$ScrollX", "$BottomY", "$ScrollX", "$TopY", '450') | Out-Null
            Start-Sleep -Milliseconds 350
            Invoke-Adb @('shell', 'input', 'swipe', "$ScrollX", "$TopY", "$ScrollX", "$BottomY", '450') | Out-Null
            Start-Sleep -Milliseconds 350
        }
    }
    $stats = Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $package, 'framestats')
    $stats | Out-File "$output/run-$run.txt"
    $stats | Select-String '^Total frames rendered:|^Janky frames:|^95th percentile:' |
        Select-Object -First 3 | ForEach-Object { Write-Output $_.Line }
}
Write-Output "Saved $Mode samples to $output. Inspect screen state and raw counters before interpreting."
