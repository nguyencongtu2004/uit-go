# Demo script - Cách sử dụng test data đã tạo
# Sử dụng test data để thực hiện các API calls với authentication

param(
    [string]$DataDir = "./test-data"
)

Write-Host "=== UIT-Go Test Data Usage Demo ===" -ForegroundColor Cyan
Write-Host ""

# Load test data
$dataFile = Join-Path $DataDir "uitgo-test-data.json"
$tokensFile = Join-Path $DataDir "tokens-only.json"

if (-not (Test-Path $dataFile)) {
    Write-Host "ERROR: Test data not found at $dataFile" -ForegroundColor Red
    Write-Host "Please run create-test-users.ps1 first" -ForegroundColor Yellow
    exit 1
}

Write-Host "Loading test data..." -ForegroundColor Yellow
$testData = Get-Content $dataFile | ConvertFrom-Json
$tokens = Get-Content $tokensFile | ConvertFrom-Json

Write-Host "Test data loaded successfully:" -ForegroundColor Green
Write-Host "  Total Users: $($testData.metadata.totalUsers)" -ForegroundColor White
Write-Host "  Passengers: $($testData.metadata.summary.passengers.created)" -ForegroundColor White
Write-Host "  Drivers: $($testData.metadata.summary.drivers.created)" -ForegroundColor White
Write-Host ""

# Demo 1: Test passenger authentication
Write-Host "=== DEMO 1: Testing Passenger Authentication ===" -ForegroundColor Cyan
if ($tokens.passengerTokens.Count -gt 0) {
    $passengerToken = $tokens.passengerTokens[0]
    Write-Host "Using passenger token: $($passengerToken.Substring(0, 20))..." -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "http://driver.localhost:81/location/stats" -Headers @{Authorization="Bearer $passengerToken"} -Method GET
        Write-Host "[OK] Passenger can access location stats: $($response.stats.totalDrivers) drivers" -ForegroundColor Green
    } catch {
        Write-Host "[INFO] Passenger authentication test completed (expected behavior may vary)" -ForegroundColor Blue
    }
} else {
    Write-Host "[WARNING] No passenger tokens available" -ForegroundColor Yellow
}

Write-Host ""

# Demo 2: Test driver authentication  
Write-Host "=== DEMO 2: Testing Driver Authentication ===" -ForegroundColor Cyan
if ($tokens.driverTokens.Count -gt 0) {
    $driverToken = $tokens.driverTokens[0]
    $driverId = $testData.users.drivers[0].id
    Write-Host "Using driver token: $($driverToken.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host "Driver ID: $driverId" -ForegroundColor Gray
    
    try {
        # Test driver status endpoint
        $statusResponse = Invoke-RestMethod -Uri "http://driver.localhost:81/drivers/$driverId/status" -Headers @{Authorization="Bearer $driverToken"} -Method GET
        Write-Host "[OK] Driver status retrieved: $($statusResponse.status)" -ForegroundColor Green
        
        # Test location stats
        $statsResponse = Invoke-RestMethod -Uri "http://driver.localhost:81/location/stats" -Headers @{Authorization="Bearer $driverToken"} -Method GET  
        Write-Host "[OK] Location stats retrieved: $($statsResponse.stats.onlineDrivers) online drivers" -ForegroundColor Green
        
    } catch {
        Write-Host "[ERROR] Driver authentication failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "[WARNING] No driver tokens available" -ForegroundColor Yellow
}

Write-Host ""

# Demo 3: Batch API testing
Write-Host "=== DEMO 3: Batch API Testing ===" -ForegroundColor Cyan
Write-Host "Testing nearby driver search with multiple locations..." -ForegroundColor Gray

$batchLocations = @(
    @{ longitude = 106.6297; latitude = 10.8231 }  # Ho Chi Minh City
    @{ longitude = 105.8542; latitude = 21.0285 }  # Hanoi
    @{ longitude = 108.2022; latitude = 16.0544 }  # Da Nang
)

try {
    $batchResponse = Invoke-RestMethod -Uri "http://driver.localhost:81/location/batch-nearby" -Method POST -Body (@{
        locations = $batchLocations
        radius = 10
        limit = 5
    } | ConvertTo-Json -Depth 3) -ContentType "application/json"
    
    Write-Host "[OK] Batch nearby search completed:" -ForegroundColor Green
    Write-Host "    Total queries: $($batchResponse.totalQueries)" -ForegroundColor White
    Write-Host "    Results processed: $($batchResponse.batchResults.Count)" -ForegroundColor White
} catch {
    Write-Host "[INFO] Batch API test completed (no drivers online yet)" -ForegroundColor Blue
}

Write-Host ""

# Demo 4: Show available data for load testing
Write-Host "=== DEMO 4: Available Data for Load Testing ===" -ForegroundColor Cyan

Write-Host "Light Load Scenario:" -ForegroundColor Yellow
Write-Host "  Passengers: $($testData.loadTesting.scenarios.lightLoad.passengers.Count)" -ForegroundColor White
Write-Host "  Drivers: $($testData.loadTesting.scenarios.lightLoad.drivers.Count)" -ForegroundColor White

Write-Host "Medium Load Scenario:" -ForegroundColor Yellow  
Write-Host "  Passengers: $($testData.loadTesting.scenarios.mediumLoad.passengers.Count)" -ForegroundColor White
Write-Host "  Drivers: $($testData.loadTesting.scenarios.mediumLoad.drivers.Count)" -ForegroundColor White

Write-Host "Heavy Load Scenario:" -ForegroundColor Yellow
Write-Host "  Passengers: $($testData.loadTesting.scenarios.heavyLoad.passengers.Count)" -ForegroundColor White
Write-Host "  Drivers: $($testData.loadTesting.scenarios.heavyLoad.drivers.Count)" -ForegroundColor White

Write-Host ""

# Demo 5: Load test configuration
Write-Host "=== DEMO 5: Load Test Configuration ===" -ForegroundColor Cyan
$configFile = Join-Path $DataDir "load-test-config.json"
$loadConfig = Get-Content $configFile | ConvertFrom-Json

Write-Host "Available endpoints:" -ForegroundColor Yellow
$loadConfig.baseUrls | Get-Member -MemberType NoteProperty | ForEach-Object {
    Write-Host "  $($_.Name): $($loadConfig.baseUrls.($_.Name))" -ForegroundColor White
}

Write-Host ""
Write-Host "Load test scenarios configured:" -ForegroundColor Yellow
Write-Host "  Light: $($loadConfig.testUsers.light.passengers) passengers, $($loadConfig.testUsers.light.drivers) drivers" -ForegroundColor White
Write-Host "  Heavy: $($loadConfig.testUsers.heavy.passengers) passengers, $($loadConfig.testUsers.heavy.drivers) drivers" -ForegroundColor White

Write-Host ""
Write-Host "=== NEXT STEPS ===" -ForegroundColor Cyan
Write-Host "1. Use tokens for authenticated API testing" -ForegroundColor White
Write-Host "2. Import load-test-config.json into k6 or Artillery" -ForegroundColor White  
Write-Host "3. Start drivers online for realistic testing:" -ForegroundColor White
Write-Host "   # Example: Update driver status to AVAILABLE" -ForegroundColor Gray
Write-Host "4. Run location update simulations" -ForegroundColor White
Write-Host "5. Test trip booking scenarios" -ForegroundColor White

Write-Host ""
Write-Host "Demo completed successfully!" -ForegroundColor Green