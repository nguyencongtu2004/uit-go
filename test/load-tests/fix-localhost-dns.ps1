# Quick fix: Add .localhost entries to hosts file for Windows
# Run as Administrator

$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$entries = @"

# UIT-Go Load Testing
127.0.0.1 user.localhost
127.0.0.1 driver.localhost
127.0.0.1 trip.localhost
127.0.0.1 traefik.localhost
"@

Write-Host "Adding .localhost entries to hosts file..." -ForegroundColor Yellow
Write-Host "Current hosts file location: $hostsPath" -ForegroundColor Gray

try {
    # Check if running as administrator
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if (-not $isAdmin) {
        Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
        Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
        exit 1
    }
    
    # Read current hosts file
    $currentHosts = Get-Content $hostsPath -Raw
    
    # Check if entries already exist
    if ($currentHosts -match "user.localhost") {
        Write-Host ".localhost entries already exist in hosts file" -ForegroundColor Green
    } else {
        # Append entries
        Add-Content -Path $hostsPath -Value $entries
        Write-Host "Successfully added .localhost entries to hosts file!" -ForegroundColor Green
    }
    
    Write-Host "`nVerifying DNS resolution..." -ForegroundColor Yellow
    $testDomains = @("user.localhost", "driver.localhost", "trip.localhost")
    
    foreach ($domain in $testDomains) {
        try {
            $resolved = [System.Net.Dns]::GetHostAddresses($domain)
            Write-Host "  OK $domain -> $($resolved[0].IPAddressToString)" -ForegroundColor Green
        } catch {
            Write-Host "  FAIL $domain - Failed to resolve" -ForegroundColor Red
        }
    }
    
    Write-Host "`nSetup complete! You can now run load tests." -ForegroundColor Green
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
