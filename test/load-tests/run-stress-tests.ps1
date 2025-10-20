# UIT-GO Complete Stress Test Suite Runner
# This script runs all stress tests in sequence

param(
    [switch]$Quick,
    [switch]$Extended,
    [switch]$All
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  UIT-GO STRESS TEST SUITE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if k6 is installed
try {
    $k6Version = k6 version
    Write-Host "✅ k6 is installed: $k6Version" -ForegroundColor Green
} catch {
    Write-Host "❌ k6 is not installed. Please install k6 first." -ForegroundColor Red
    Write-Host "   Visit: https://k6.io/docs/getting-started/installation/" -ForegroundColor Yellow
    exit 1
}

# Check if services are running
Write-Host "`n🔍 Checking if services are running..." -ForegroundColor Yellow

$services = @(
    @{Name="User Service"; Url="http://user.localhost:81/health"},
    @{Name="Driver Service"; Url="http://driver.localhost:81/health"},
    @{Name="Trip Service"; Url="http://trip.localhost:81/health"}
)

$allHealthy = $true
foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri $service.Url -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ $($service.Name) is healthy" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $($service.Name) returned status $($response.StatusCode)" -ForegroundColor Red
            $allHealthy = $false
        }
    } catch {
        Write-Host "  ❌ $($service.Name) is not reachable" -ForegroundColor Red
        $allHealthy = $false
    }
}

if (-not $allHealthy) {
    Write-Host "`n❌ Some services are not healthy. Please start all services first." -ForegroundColor Red
    Write-Host "   Run: docker compose up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ All services are healthy!" -ForegroundColor Green

# Create results directory if it doesn't exist
$resultsDir = "test\load-tests\results"
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
    Write-Host "✅ Created results directory" -ForegroundColor Green
}

# Test selection
$tests = @()

if ($Quick) {
    $tests += @{
        Name = "Quick Stress Test (2 minutes)"
        Script = "test\load-tests\k6-stress-short.js"
    }
}

if ($Extended) {
    $tests += @{
        Name = "Extended Stress Test (5 minutes)"
        Script = "test\load-tests\k6-stress-extended.js"
    }
}

if ($All -or (-not $Quick -and -not $Extended)) {
    $tests = @(
        @{
            Name = "1. Simple Infrastructure Test"
            Script = "test\load-tests\k6-simple-test.js"
        },
        @{
            Name = "2. Short Stress Test (2 minutes)"
            Script = "test\load-tests\k6-stress-short.js"
        },
        @{
            Name = "3. Extended Stress Test (5 minutes)"
            Script = "test\load-tests\k6-stress-extended.js"
        }
    )
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  STARTING TEST SUITE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total tests to run: $($tests.Count)" -ForegroundColor Yellow
Write-Host ""

$results = @()
$testNumber = 1

foreach ($test in $tests) {
    Write-Host "`n[$testNumber/$($tests.Count)] Running: $($test.Name)" -ForegroundColor Cyan
    Write-Host "Script: $($test.Script)" -ForegroundColor Gray
    Write-Host "Started at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host ""
    
    $startTime = Get-Date
    
    try {
        # Run k6 test
        k6 run $test.Script
        
        $duration = (Get-Date) - $startTime
        $status = "✅ PASSED"
        $statusColor = "Green"
        
    } catch {
        $duration = (Get-Date) - $startTime
        $status = "❌ FAILED"
        $statusColor = "Red"
        Write-Host "`nError: $_" -ForegroundColor Red
    }
    
    $results += @{
        Test = $test.Name
        Status = $status
        Duration = $duration.ToString("mm\:ss")
        Script = $test.Script
    }
    
    Write-Host "`n$status - Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor $statusColor
    
    # Wait a bit between tests
    if ($testNumber -lt $tests.Count) {
        Write-Host "`n⏸️  Waiting 10 seconds before next test..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    }
    
    $testNumber++
}

# Generate summary report
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TEST SUITE SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($result in $results) {
    Write-Host "$($result.Status) $($result.Test)" -ForegroundColor $(if ($result.Status -match "PASSED") { "Green" } else { "Red" })
    Write-Host "   Duration: $($result.Duration)" -ForegroundColor Gray
}

$passedCount = ($results | Where-Object { $_.Status -match "PASSED" }).Count
$totalCount = $results.Count

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Results: $passedCount/$totalCount tests passed" -ForegroundColor $(if ($passedCount -eq $totalCount) { "Green" } else { "Yellow" })
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Save summary to file
$summaryFile = "$resultsDir\test-suite-summary-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').txt"
$summaryContent = @"
UIT-GO STRESS TEST SUITE SUMMARY
=====================================
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Total Tests: $totalCount
Passed: $passedCount
Failed: $($totalCount - $passedCount)

TEST RESULTS:
"@

foreach ($result in $results) {
    $summaryContent += "`n$($result.Status) $($result.Test) [$($result.Duration)]"
}

$summaryContent | Out-File -FilePath $summaryFile -Encoding UTF8
Write-Host "📄 Summary saved to: $summaryFile" -ForegroundColor Green

# Open results directory
Write-Host "`n📁 Opening results directory..." -ForegroundColor Yellow
Invoke-Item $resultsDir

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
Write-Host ""
