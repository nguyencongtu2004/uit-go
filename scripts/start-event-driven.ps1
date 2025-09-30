# UIT-Go Event-Driven Architecture Startup Script
# Khởi động các services với Kafka event streaming và WebSocket support

Write-Host "🚀 Starting UIT-Go Event-Driven Architecture..." -ForegroundColor Green

# Check if Docker Desktop is running
try {
    $dockerStatus = docker ps 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker Desktop is not running. Please start Docker Desktop first." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Docker Desktop is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not available. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Start the infrastructure services
Write-Host "`n📦 Starting infrastructure services..." -ForegroundColor Cyan
docker-compose up -d mongodb-users mongodb-drivers mongodb-trips redis kafka

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start infrastructure services" -ForegroundColor Red
    exit 1
}

# Wait for services to be healthy
Write-Host "`n⏳ Waiting for infrastructure services to be healthy..." -ForegroundColor Cyan
$maxWait = 120  # 2 minutes
$waited = 0

do {
    Start-Sleep -Seconds 5
    $waited += 5
    
    $kafkaHealth = docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list 2>$null
    $redisHealth = docker exec uit-go-redis redis-cli -a redis123 ping 2>$null
    
    if ($kafkaHealth -and $redisHealth -eq "PONG") {
        Write-Host "✅ Infrastructure services are healthy" -ForegroundColor Green
        break
    }
    
    if ($waited -ge $maxWait) {
        Write-Host "❌ Timeout waiting for infrastructure services" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "   Still waiting... ($waited/$maxWait seconds)" -ForegroundColor Yellow
} while ($true)

# Initialize Kafka topics
Write-Host "`n📋 Initializing Kafka topics..." -ForegroundColor Cyan
try {
    node scripts/setup-kafka-topics.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Kafka topics initialized successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Kafka topics may already exist, continuing..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not initialize Kafka topics, will be created automatically" -ForegroundColor Yellow
}

# Start application services
Write-Host "`n🏢 Starting application services..." -ForegroundColor Cyan
docker-compose up -d user-service driver-service trip-service

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start application services" -ForegroundColor Red
    exit 1
}

# Start Traefik (API Gateway)
Write-Host "`n🌐 Starting Traefik API Gateway..." -ForegroundColor Cyan
docker-compose up -d traefik

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start Traefik" -ForegroundColor Red
    exit 1
}

# Wait for application services to be ready
Write-Host "`n⏳ Waiting for application services to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 15

# Check service health
Write-Host "`n🔍 Checking service health..." -ForegroundColor Cyan

$services = @(
    @{Name="User Service"; URL="http://user.localhost:81/health"},
    @{Name="Driver Service"; URL="http://driver.localhost:81/health"},
    @{Name="Trip Service"; URL="http://trip.localhost:81/health"}
)

$allHealthy = $true

foreach ($service in $services) {
    try {
        $response = Invoke-RestMethod -Uri $service.URL -TimeoutSec 10 -ErrorAction Stop
        if ($response.status -eq "OK") {
            Write-Host "   ✅ $($service.Name): Healthy" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $($service.Name): $($response.status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ $($service.Name): Not responding" -ForegroundColor Red
        $allHealthy = $false
    }
}

# Display startup summary
Write-Host "`n" -NoNewline
Write-Host "🎉 UIT-Go Event-Driven Architecture Startup Complete!" -ForegroundColor Green
Write-Host ""

if ($allHealthy) {
    Write-Host "✅ All services are healthy and ready for load testing!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some services may still be starting up. Please check manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📊 Service Endpoints:" -ForegroundColor Cyan
Write-Host "   • User Service:   http://user.localhost:81" -ForegroundColor White
Write-Host "   • Driver Service: http://driver.localhost:81" -ForegroundColor White  
Write-Host "   • Trip Service:   http://trip.localhost:81" -ForegroundColor White
Write-Host "   • Traefik Dashboard: http://localhost:8080" -ForegroundColor White
Write-Host ""
Write-Host "🔄 Event Topics:" -ForegroundColor Cyan
Write-Host "   • trip-events (10 partitions)" -ForegroundColor White
Write-Host "   • location-updates (20 partitions)" -ForegroundColor White
Write-Host "   • user-notifications (5 partitions)" -ForegroundColor White
Write-Host ""
Write-Host "🧪 Load Testing:" -ForegroundColor Cyan
Write-Host "   • Event Flow Test: node scripts/test-event-flow.js" -ForegroundColor White
Write-Host "   • View Logs: docker-compose logs -f [service-name]" -ForegroundColor White
Write-Host ""
Write-Host "📈 Targets:" -ForegroundColor Cyan
Write-Host "   • 1000 drivers with 5-second location updates" -ForegroundColor White
Write-Host "   • 100 concurrent trip requests" -ForegroundColor White
Write-Host "   • Real-time WebSocket + Kafka event processing" -ForegroundColor White
Write-Host ""

# Optional: Run a quick event flow test
$runTest = Read-Host "Do you want to run a quick event flow test? (y/N)"
if ($runTest -eq "y" -or $runTest -eq "Y") {
    Write-Host "`n🧪 Running Event Flow Test..." -ForegroundColor Cyan
    node scripts/test-event-flow.js
}

Write-Host "`n💡 Use 'docker-compose logs -f' to monitor real-time logs" -ForegroundColor Blue
Write-Host "💡 Use 'docker-compose down' to stop all services" -ForegroundColor Blue