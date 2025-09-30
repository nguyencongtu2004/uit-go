# UIT-Go Mass User Creation & Token Generation Script
# Tạo users hàng loạt và lấy authentication tokens để sử dụng cho load testing

param(
    [int]$PassengerCount = 1,
    [int]$DriverCount = 1,
    [string]$BaseUrl = "http://user.localhost:81",
    [string]$OutputDir = "./test-data",
    [string]$Password = "LoadTest123!"
)

Write-Host "=== UIT-Go Mass User & Token Generator ===" -ForegroundColor Cyan
Write-Host "Creating $PassengerCount passengers and $DriverCount drivers..." -ForegroundColor White
Write-Host "Output directory: $OutputDir" -ForegroundColor Gray
Write-Host ""

# Tạo thư mục output nếu chưa có
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "[INFO] Created output directory: $OutputDir" -ForegroundColor Blue
}

# Test connection
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method GET -TimeoutSec 5
    Write-Host "[OK] User Service is healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Cannot connect to User Service at $BaseUrl" -ForegroundColor Red
    Write-Host "Make sure the service is running and accessible." -ForegroundColor Yellow
    exit 1
}

# Restart User Service to enable test endpoints
Write-Host "Restarting User Service to ensure test endpoints are available..." -ForegroundColor Yellow
try {
    $restart = docker-compose restart user-service 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] User Service restarted successfully" -ForegroundColor Green
        Start-Sleep -Seconds 3
    } else {
        Write-Host "[WARNING] Failed to restart User Service: $restart" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Could not restart service: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ============= STEP 1: CREATE PASSENGERS =============
Write-Host ""
Write-Host "STEP 1: Creating passengers..." -ForegroundColor Yellow

$passengers = @()
for ($i = 1; $i -le $PassengerCount; $i++) {
    $passengers += @{
        fullName = "Test Passenger $i"
        email = "passenger$i@uitgo-load.test"
        password = $Password
        phoneNumber = "090$(Get-Random -Minimum 1000000 -Maximum 9999999)"
        role = "PASSENGER"
    }
}

$createdPassengers = @()
try {
    $bulkData = @{ 
        users = $passengers
        skipExisting = $true
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/test/bulk-create-users" -Method POST -Body $bulkData -ContentType "application/json"
    
    if ($response.success) {
        $createdPassengers = $response.data.results.created
        Write-Host "  [OK] Created: $($response.data.summary.created), Skipped: $($response.data.summary.skipped), Errors: $($response.data.summary.errors)" -ForegroundColor Green
        
        if ($response.data.summary.errors -gt 0) {
            Write-Host "  [WARNING] Some passenger creation failed. Check logs." -ForegroundColor Yellow
            $response.data.results.errors | ForEach-Object {
                Write-Host "    - $($_.email): $($_.error)" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "  [ERROR] Bulk passenger creation failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "  Details: $($_.ErrorDetails)" -ForegroundColor Red
    }
}

# ============= STEP 2: CREATE DRIVERS =============
Write-Host ""
Write-Host "STEP 2: Creating drivers..." -ForegroundColor Yellow

$drivers = @()
$vehicleTypes = @("MOTORBIKE", "CAR_4_SEAT", "CAR_7_SEAT")
$makes = @("Toyota", "Honda", "Hyundai", "Mazda", "Ford", "Kia")
$models = @("Vios", "City", "Accent", "CX-5", "EcoSport", "Cerato")
$colors = @("White", "Silver", "Black", "Blue", "Red", "Gray")

for ($i = 1; $i -le $DriverCount; $i++) {
    $drivers += @{
        fullName = "Test Driver $i"
        email = "driver$i@uitgo-load.test"
        password = $Password
        phoneNumber = "091$(Get-Random -Minimum 1000000 -Maximum 9999999)"
        role = "DRIVER"
        driverInfo = @{
            vehicle = @{
                licensePlate = "$(Get-Random -Minimum 10 -Maximum 99)A-$(Get-Random -Minimum 100 -Maximum 999).$(Get-Random -Minimum 10 -Maximum 99)"
                make = $makes | Get-Random
                model = $models | Get-Random
                year = Get-Random -Minimum 2015 -Maximum 2024
                color = $colors | Get-Random
                vehicleType = $vehicleTypes | Get-Random
            }
            driverStatus = "OFFLINE"
            totalTrips = Get-Random -Minimum 0 -Maximum 50
            lastLocationUpdate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        }
    }
}

$createdDrivers = @()
try {
    $bulkData = @{ 
        users = $drivers
        skipExisting = $true
    } | ConvertTo-Json -Depth 4
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/test/bulk-create-users" -Method POST -Body $bulkData -ContentType "application/json"
    
    if ($response.success) {
        $createdDrivers = $response.data.results.created
        Write-Host "  [OK] Created: $($response.data.summary.created), Skipped: $($response.data.summary.skipped), Errors: $($response.data.summary.errors)" -ForegroundColor Green
        
        if ($response.data.summary.errors -gt 0) {
            Write-Host "  [WARNING] Some driver creation failed. Check logs." -ForegroundColor Yellow
            $response.data.results.errors | ForEach-Object {
                Write-Host "    - $($_.email): $($_.error)" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "  [ERROR] Bulk driver creation failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "  Details: $($_.ErrorDetails)" -ForegroundColor Red
    }
}

# ============= STEP 3: GENERATE LOGIN CREDENTIALS =============
Write-Host ""
Write-Host "STEP 3: Preparing credentials for bulk login..." -ForegroundColor Yellow

$allCredentials = @()

# Add passenger credentials
foreach ($passenger in $createdPassengers) {
    $allCredentials += @{
        email = $passenger.email
        password = $Password
    }
}

# Add driver credentials
foreach ($driver in $createdDrivers) {
    $allCredentials += @{
        email = $driver.email
        password = $Password
    }
}

Write-Host "  [INFO] Prepared $($allCredentials.Count) credentials for login" -ForegroundColor Blue

# ============= STEP 4: BULK LOGIN TO GET TOKENS =============
Write-Host ""
Write-Host "STEP 4: Performing bulk login to retrieve tokens..." -ForegroundColor Yellow

$allTokens = @()
$batchSize = 50  # Process in batches to avoid timeouts

for ($i = 0; $i -lt $allCredentials.Count; $i += $batchSize) {
    $batch = $allCredentials[$i..([Math]::Min($i + $batchSize - 1, $allCredentials.Count - 1))]
    $batchNum = [Math]::Floor($i / $batchSize) + 1
    $totalBatches = [Math]::Ceiling($allCredentials.Count / $batchSize)
    
    Write-Host "  Processing batch $batchNum/$totalBatches ($($batch.Count) credentials)..." -ForegroundColor Gray
    
    try {
        $loginData = @{ credentials = $batch } | ConvertTo-Json -Depth 3
        $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/test/bulk-login" -Method POST -Body $loginData -ContentType "application/json"
        
        if ($loginResponse.success) {
            foreach ($result in $loginResponse.data.results) {
                if ($result.success) {
                    $allTokens += $result
                }
            }
            Write-Host "    [OK] Batch $batchNum`: $($loginResponse.data.summary.successful)/$($loginResponse.data.summary.total) successful" -ForegroundColor Green
        }
    } catch {
        Write-Host "    [ERROR] Batch $batchNum failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Small delay between batches
    if ($i + $batchSize -lt $allCredentials.Count) {
        Start-Sleep -Milliseconds 500
    }
}

Write-Host "  [COMPLETE] Total tokens retrieved: $($allTokens.Count)" -ForegroundColor Green

# ============= STEP 5: ORGANIZE AND SAVE DATA =============
Write-Host ""
Write-Host "STEP 5: Organizing and saving data to files..." -ForegroundColor Yellow

# Separate tokens by role
$passengerTokens = $allTokens | Where-Object { $_.user.role -eq "PASSENGER" }
$driverTokens = $allTokens | Where-Object { $_.user.role -eq "DRIVER" }

# Create comprehensive data structure
$testDataPackage = @{
    metadata = @{
        createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        createdBy = "UIT-Go Mass User Generator"
        version = "1.0"
        baseUrl = $BaseUrl
        totalUsers = $allTokens.Count
        summary = @{
            passengers = @{
                requested = $PassengerCount
                created = $passengerTokens.Count
            }
            drivers = @{
                requested = $DriverCount
                created = $driverTokens.Count
            }
        }
    }
    users = @{
        passengers = $passengerTokens | ForEach-Object {
            @{
                id = $_.user.id
                fullName = $_.user.fullName
                email = $_.user.email
                role = $_.user.role
                token = $_.token
                createdForTesting = $true
            }
        }
        drivers = $driverTokens | ForEach-Object {
            @{
                id = $_.user.id
                fullName = $_.user.fullName
                email = $_.user.email
                role = $_.user.role
                token = $_.token
                createdForTesting = $true
            }
        }
    }
    quickAccess = @{
        allTokens = $allTokens | ForEach-Object { $_.token }
        passengerTokens = $passengerTokens | ForEach-Object { $_.token }
        driverTokens = $driverTokens | ForEach-Object { $_.token }
        sampleUsers = @{
            samplePassenger = if ($passengerTokens.Count -gt 0) { $passengerTokens[0] } else { $null }
            sampleDriver = if ($driverTokens.Count -gt 0) { $driverTokens[0] } else { $null }
        }
    }
    loadTesting = @{
        endpoints = @{
            userService = $BaseUrl
            driverService = "http://driver.localhost:81"
            tripService = "http://trip.localhost:81"
        }
        scenarios = @{
            lightLoad = @{
                passengers = if ($passengerTokens.Count -ge 10) { $passengerTokens[0..9] } else { $passengerTokens }
                drivers = if ($driverTokens.Count -ge 20) { $driverTokens[0..19] } else { $driverTokens }
            }
            mediumLoad = @{
                passengers = if ($passengerTokens.Count -ge 25) { $passengerTokens[0..24] } else { $passengerTokens }
                drivers = if ($driverTokens.Count -ge 50) { $driverTokens[0..49] } else { $driverTokens }
            }
            heavyLoad = @{
                passengers = $passengerTokens
                drivers = $driverTokens
            }
        }
    }
}

# Save main data file
$mainFile = Join-Path $OutputDir "uitgo-test-data.json"
try {
    $testDataPackage | ConvertTo-Json -Depth 6 | Out-File -FilePath $mainFile -Encoding UTF8
    Write-Host "  [OK] Main data saved: $mainFile" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Failed to save main data: $($_.Exception.Message)" -ForegroundColor Red
}

# Save tokens-only file for quick access
$tokensFile = Join-Path $OutputDir "tokens-only.json"
try {
    $testDataPackage.quickAccess | ConvertTo-Json -Depth 3 | Out-File -FilePath $tokensFile -Encoding UTF8
    Write-Host "  [OK] Tokens saved: $tokensFile" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Failed to save tokens: $($_.Exception.Message)" -ForegroundColor Red
}

# Save load testing config
$loadTestConfig = @{
    baseUrls = $testDataPackage.loadTesting.endpoints
    testUsers = @{
        light = @{
            passengers = $testDataPackage.loadTesting.scenarios.lightLoad.passengers.Count
            drivers = $testDataPackage.loadTesting.scenarios.lightLoad.drivers.Count
            tokens = @{
                passengers = $testDataPackage.loadTesting.scenarios.lightLoad.passengers | ForEach-Object { $_.token }
                drivers = $testDataPackage.loadTesting.scenarios.lightLoad.drivers | ForEach-Object { $_.token }
            }
        }
        heavy = @{
            passengers = $testDataPackage.loadTesting.scenarios.heavyLoad.passengers.Count
            drivers = $testDataPackage.loadTesting.scenarios.heavyLoad.drivers.Count
            tokens = @{
                passengers = $testDataPackage.loadTesting.scenarios.heavyLoad.passengers | ForEach-Object { $_.token }
                drivers = $testDataPackage.loadTesting.scenarios.heavyLoad.drivers | ForEach-Object { $_.token }
            }
        }
    }
    k6Config = @{
        scenarios = @{
            passenger_booking = @{
                executor = "ramping-vus"
                startVUs = 0
                stages = @(
                    @{ duration = "30s"; target = 10 }
                    @{ duration = "2m"; target = 50 }
                    @{ duration = "1m"; target = 100 }
                    @{ duration = "30s"; target = 0 }
                )
            }
            driver_location_updates = @{
                executor = "constant-vus"
                vus = 25
                duration = "5m"
            }
        }
    }
}

$configFile = Join-Path $OutputDir "load-test-config.json"
try {
    $loadTestConfig | ConvertTo-Json -Depth 5 | Out-File -FilePath $configFile -Encoding UTF8
    Write-Host "  [OK] Load test config saved: $configFile" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Failed to save load test config: $($_.Exception.Message)" -ForegroundColor Red
}

# ============= SUMMARY =============
Write-Host ""
Write-Host "=== CREATION SUMMARY ===" -ForegroundColor Cyan
Write-Host "  Total Users Created: $($allTokens.Count)" -ForegroundColor White
Write-Host "  Passengers: $($passengerTokens.Count)/$PassengerCount" -ForegroundColor Green
Write-Host "  Drivers: $($driverTokens.Count)/$DriverCount" -ForegroundColor Green
Write-Host ""

Write-Host "=== FILES CREATED ===" -ForegroundColor Cyan
Write-Host "  Output Directory: $OutputDir" -ForegroundColor White
Write-Host "    - uitgo-test-data.json    - Complete user data with tokens" -ForegroundColor Gray
Write-Host "    - tokens-only.json        - Quick access to tokens only" -ForegroundColor Gray
Write-Host "    - load-test-config.json   - Load testing configuration" -ForegroundColor Gray
Write-Host ""

Write-Host "=== QUICK USAGE EXAMPLES ===" -ForegroundColor Cyan
Write-Host "  Load all test data from: $mainFile" -ForegroundColor White
Write-Host "  Load tokens from: $tokensFile" -ForegroundColor White
Write-Host "  Load test config from: $configFile" -ForegroundColor White
Write-Host ""

if ($allTokens.Count -gt 0) {
    Write-Host "SUCCESS! Test data generation completed." -ForegroundColor Green
    Write-Host "Ready for load testing and development!" -ForegroundColor Green
} else {
    Write-Host "WARNING! No tokens were generated." -ForegroundColor Yellow
    Write-Host "Check the logs above for errors." -ForegroundColor Yellow
}