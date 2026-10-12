# ==============================================================================
# Script Runner Pengujian Beban (Load Test) k6 untuk PayrollHub
# ==============================================================================

param (
    [string]$TargetUrl = "http://127.0.0.1:8000/api",
    [string]$Scenario = "smoke" # options: smoke, rush, portal, stress
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       K6 LOAD TESTING SUITE - PAYROLLHUB ABSENSI         " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Target API URL : $TargetUrl" -ForegroundColor Green
Write-Host "Pilihan Skenario: $Scenario" -ForegroundColor Green
Write-Host ""

# 1. Cek k6 executable
$k6Check = Get-Command k6 -ErrorAction SilentlyContinue
if (-not $k6Check) {
    Write-Host "[ERROR] k6 tidak ditemukan di sistem!" -ForegroundColor Red
    Write-Host "Silakan download k6 dari https://k6.io/docs/get-started/installation/" -ForegroundColor Yellow
    Write-Host "atau instal via winget: winget install k6 --source winget" -ForegroundColor Yellow
    exit 1
}

# 2. Cek apakah file users.json sudah ada
$fixtureFile = Join-Path $PSScriptRoot "fixtures\users.json"
if (-not (Test-Path $fixtureFile)) {
    Write-Host "[INFO] Fixture user belum dibuat. Menjalankan generator user..." -ForegroundColor Cyan
    php (Join-Path $PSScriptRoot "generate_test_users.php")
}

# 3. Tentukan file skenario
$scriptFile = ""
switch ($Scenario.ToLower()) {
    "smoke" {
        $scriptFile = Join-Path $PSScriptRoot "scenarios\04_quick_smoke_test.js"
        Write-Host ">> Menjalankan Quick Smoke Test (5 VU, 10s)..." -ForegroundColor White
    }
    "rush" {
        $scriptFile = Join-Path $PSScriptRoot "scenarios\01_attendance_rush_hour.js"
        Write-Host ">> Menjalankan Peak Rush Hour Test (Simulasi 4.000 Karyawan Absen Pagi)..." -ForegroundColor White
    }
    "portal" {
        $scriptFile = Join-Path $PSScriptRoot "scenarios\02_portal_browsing.js"
        Write-Host ">> Menjalankan Portal Browsing Test (Slip Gaji & Dashboard)..." -ForegroundColor White
    }
    "stress" {
        $scriptFile = Join-Path $PSScriptRoot "scenarios\03_stress_concurrency.js"
        Write-Host ">> Menjalankan Stress Test Concurrency (Mencari Kapasitas Maksimal VPS)..." -ForegroundColor White
    }
    default {
        Write-Host "[ERROR] Pilihan skenario tidak valid. Gunakan: smoke, rush, portal, atau stress" -ForegroundColor Red
        exit 1
    }
}

# 4. Buat folder laporan jika belum ada
$reportsDir = Join-Path $PSScriptRoot "reports"
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$summaryJson = Join-Path $reportsDir "summary_${Scenario}_${timestamp}.json"

Write-Host "Menjalankan k6 sekarang..." -ForegroundColor Yellow
Write-Host "Command: k6 run --env BASE_URL=$TargetUrl --summary-export=$summaryJson `"$scriptFile`"" -ForegroundColor DarkGray
Write-Host ""

& k6 run --env BASE_URL=$TargetUrl --summary-export=$summaryJson "$scriptFile"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "[SELESAI] Hasil ringkasan tersimpan di: $summaryJson" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
