/**
 * K6 Load Test - Full System Scenario
 * Combined stress test simulating real-world usage:
 * - 1000 drivers updating location
 * - 100 concurrent trip bookings
 * - User authentication
 * - Real-time notifications
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const systemHealthScore = new Gauge('system_health_score');
const overallSuccessRate = new Rate('overall_success');
const driverLocationRate = new Rate('driver_location_success');
const passengerBookingRate = new Rate('passenger_booking_success');
const apiErrors = new Counter('api_errors');
const totalOperations = new Counter('total_operations');

// Load test data
const testData = JSON.parse(open('../test-data/tokens-only.json'));
const passengerTokens = new SharedArray('passengerTokens', () => 
  Object.values(testData.passengerTokens || {})
);
const driverTokens = new SharedArray('driverTokens', () => 
  Object.values(testData.driverTokens || {})
);

// Service URLs
const SERVICES = {
  user: __ENV.USER_SERVICE_URL || 'http://user.localhost:81',
  driver: __ENV.DRIVER_SERVICE_URL || 'http://driver.localhost:81',
  trip: __ENV.TRIP_SERVICE_URL || 'http://trip.localhost:81',
};

export const options = {
  scenarios: {
    // Scenario 1: Driver location updates (High frequency)
    driver_location_updates: {
      executor: 'constant-vus',
      vus: 1000,
      duration: '10m',
      exec: 'driverLocationScenario',
      startTime: '0s',
      gracefulStop: '30s',
    },
    
    // Scenario 2: Passenger bookings (Medium frequency)
    passenger_bookings: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { duration: '2m', target: 10 },  // Warm up
        { duration: '5m', target: 50 },  // Ramp to 50 bookings/sec
        { duration: '2m', target: 100 }, // Peak load
        { duration: '1m', target: 50 },  // Cool down
      ],
      preAllocatedVUs: 200,
      maxVUs: 500,
      exec: 'passengerBookingScenario',
      startTime: '30s',
      gracefulStop: '30s',
    },

    // Scenario 3: System monitoring
    system_health_check: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10m',
      exec: 'healthCheckScenario',
      startTime: '0s',
    },
  },

  thresholds: {
    // Overall system thresholds
    'http_req_duration': ['p(95)<3000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.05'],
    'overall_success': ['rate>0.90'],
    
    // Service-specific thresholds
    'http_req_duration{service:driver}': ['p(95)<100'],
    'http_req_duration{service:trip}': ['p(95)<3000'],
    'driver_location_success': ['rate>0.95'],
    'passenger_booking_success': ['rate>0.85'],
    
    // System health
    'system_health_score': ['value>80'],
  },

  // Test summaries
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  summaryTimeUnit: 'ms',
};

// HCMC coordinates
const HCMC_BOUNDS = {
  lat: { min: 10.7, max: 10.85 },
  lng: { min: 106.6, max: 106.75 },
};

const LOCATIONS = [
  { name: 'District 1', pickup: { lat: 10.7769, lng: 106.7009 }, dropoff: { lat: 10.7829, lng: 106.6960 } },
  { name: 'District 3', pickup: { lat: 10.7839, lng: 106.6897 }, dropoff: { lat: 10.7769, lng: 106.7009 } },
  { name: 'Thu Duc', pickup: { lat: 10.8495, lng: 106.7718 }, dropoff: { lat: 10.7769, lng: 106.7009 } },
  { name: 'Binh Thanh', pickup: { lat: 10.8142, lng: 106.7052 }, dropoff: { lat: 10.7829, lng: 106.6960 } },
  { name: 'Tan Binh', pickup: { lat: 10.8006, lng: 106.6541 }, dropoff: { lat: 10.7769, lng: 106.7009 } },
];

function generateLocation() {
  return {
    latitude: HCMC_BOUNDS.lat.min + Math.random() * (HCMC_BOUNDS.lat.max - HCMC_BOUNDS.lat.min),
    longitude: HCMC_BOUNDS.lng.min + Math.random() * (HCMC_BOUNDS.lng.max - HCMC_BOUNDS.lng.min),
  };
}

function getRandomLocation() {
  return LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
}

export function setup() {
  console.log('=== K6 Full System Load Test Setup ===');
  console.log(`User Service: ${SERVICES.user}`);
  console.log(`Driver Service: ${SERVICES.driver}`);
  console.log(`Trip Service: ${SERVICES.trip}`);
  console.log(`Passenger Tokens: ${passengerTokens.length}`);
  console.log(`Driver Tokens: ${driverTokens.length}`);
  console.log('');
  console.log('Scenarios:');
  console.log('  1. Driver Location Updates: 1000 concurrent drivers');
  console.log('  2. Passenger Bookings: Up to 100 bookings/sec');
  console.log('  3. System Health Monitoring: Continuous');
  console.log('');
  
  // Verify all services are healthy
  const healthChecks = [
    { name: 'User Service', url: `${SERVICES.user}/health` },
    { name: 'Driver Service', url: `${SERVICES.driver}/health` },
    { name: 'Trip Service', url: `${SERVICES.trip}/health` },
  ];

  let allHealthy = true;
  healthChecks.forEach(({ name, url }) => {
    const response = http.get(url);
    if (response.status === 200) {
      console.log(`✓ ${name}: HEALTHY`);
    } else {
      console.error(`✗ ${name}: UNHEALTHY (${response.status})`);
      allHealthy = false;
    }
  });

  if (!allHealthy) {
    throw new Error('Not all services are healthy. Aborting test.');
  }

  console.log('\n🚀 All systems ready. Starting load test...\n');
  
  return {
    services: SERVICES,
    passengerTokens,
    driverTokens,
  };
}

// Scenario 1: Driver location updates
export function driverLocationScenario(data) {
  const driverIndex = __VU % driverTokens.length;
  const token = driverTokens[driverIndex];
  
  if (!token) return;

  const driverId = `driver_${driverIndex + 1}`;
  const location = generateLocation();

  const response = http.put(
    `${data.services.driver}/drivers/${driverId}/location`,
    JSON.stringify(location),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      tags: { 
        name: 'DriverLocationUpdate',
        service: 'driver',
      },
    }
  );

  totalOperations.add(1);
  
  const success = check(response, {
    'location update successful': (r) => r.status === 200,
    'response time acceptable': (r) => r.timings.duration < 100,
  });

  driverLocationRate.add(success);
  overallSuccessRate.add(success);

  if (!success) {
    apiErrors.add(1);
  }

  sleep(5); // Update every 5 seconds
}

// Scenario 2: Passenger booking flow
export function passengerBookingScenario(data) {
  const passengerIndex = __ITER % passengerTokens.length;
  const token = passengerTokens[passengerIndex];
  
  if (!token) return;

  const location = getRandomLocation();
  let tripId = null;
  let bookingSuccess = false;

  // Step 1: Fare estimate
  group('Fare Estimate', () => {
    const response = http.post(
      `${data.services.trip}/booking/estimate`,
      JSON.stringify({
        pickup: location.pickup,
        dropoff: location.dropoff,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        tags: {
          name: 'FareEstimate',
          service: 'trip',
        },
      }
    );

    totalOperations.add(1);
    check(response, {
      'fare estimate successful': (r) => r.status === 200,
    });
  });

  // Step 2: Create booking
  group('Create Booking', () => {
    const response = http.post(
      `${data.services.trip}/trips`,
      JSON.stringify({
        pickup: location.pickup,
        dropoff: location.dropoff,
        pickupAddress: `${location.name} - Pickup`,
        dropoffAddress: `${location.name} - Dropoff`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        tags: {
          name: 'CreateBooking',
          service: 'trip',
        },
      }
    );

    totalOperations.add(1);

    bookingSuccess = check(response, {
      'booking created': (r) => r.status === 201,
      'has trip ID': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.data && body.data._id) {
            tripId = body.data._id;
            return true;
          }
        } catch {
          return false;
        }
        return false;
      },
    });

    passengerBookingRate.add(bookingSuccess);
    overallSuccessRate.add(bookingSuccess);

    if (!bookingSuccess) {
      apiErrors.add(1);
    }
  });

  // Step 3: Monitor trip status
  if (tripId && bookingSuccess) {
    group('Monitor Trip', () => {
      sleep(2); // Wait for driver matching

      const response = http.get(
        `${data.services.trip}/trips/${tripId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          tags: {
            name: 'GetTripStatus',
            service: 'trip',
          },
        }
      );

      totalOperations.add(1);
      check(response, {
        'trip status retrieved': (r) => r.status === 200,
      });
    });
  }

  sleep(Math.random() * 3 + 2); // 2-5 seconds between bookings
}

// Scenario 3: System health monitoring
export function healthCheckScenario(data) {
  const healthStatuses = {
    user: 0,
    driver: 0,
    trip: 0,
  };

  // Check all services
  Object.entries(data.services).forEach(([service, url]) => {
    const response = http.get(`${url}/health`, {
      tags: {
        name: 'HealthCheck',
        service: service,
      },
    });

    if (response.status === 200) {
      healthStatuses[service] = 100;
    } else if (response.status === 503) {
      healthStatuses[service] = 50; // Degraded
    } else {
      healthStatuses[service] = 0; // Down
    }
  });

  // Calculate overall system health score (0-100)
  const avgHealth = Object.values(healthStatuses).reduce((a, b) => a + b, 0) / 
                    Object.keys(healthStatuses).length;
  
  systemHealthScore.add(avgHealth);

  sleep(10); // Check every 10 seconds
}

export function teardown(data) {
  console.log('\n=== K6 Full System Load Test Complete ===');
  console.log('Generating detailed reports...\n');
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`results/full-scenario-${timestamp}.json`]: JSON.stringify(data, null, 2),
    [`results/full-scenario-${timestamp}.txt`]: generateDetailedSummary(data),
    'stdout': generateDetailedSummary(data, true),
  };
}

function generateDetailedSummary(data, colorize = false) {
  const metrics = data.metrics;
  const line = '='.repeat(70);
  
  let summary = `\n${line}\n`;
  summary += 'UIT-GO FULL SYSTEM LOAD TEST SUMMARY\n';
  summary += `${line}\n\n`;
  
  // Test Overview
  summary += '📊 TEST OVERVIEW\n';
  summary += `-`.repeat(70) + '\n';
  summary += `Duration: ${data.state.testRunDurationMs / 1000}s\n`;
  summary += `Total VUs: ${data.root_group.checks.length}\n`;
  summary += `Total Operations: ${metrics.total_operations.values.count}\n`;
  summary += `Total Requests: ${metrics.http_reqs.values.count}\n\n`;
  
  // Success Rates
  summary += '✅ SUCCESS RATES\n';
  summary += '-'.repeat(70) + '\n';
  summary += `Overall Success Rate: ${(metrics.overall_success.values.rate * 100).toFixed(2)}%\n`;
  summary += `Driver Location Updates: ${(metrics.driver_location_success.values.rate * 100).toFixed(2)}%\n`;
  summary += `Passenger Bookings: ${(metrics.passenger_booking_success.values.rate * 100).toFixed(2)}%\n`;
  summary += `API Errors: ${metrics.api_errors.values.count}\n\n`;
  
  // Performance Metrics
  summary += '⚡ PERFORMANCE METRICS\n';
  summary += '-'.repeat(70) + '\n';
  summary += `Average Response Time: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `Median Response Time: ${metrics.http_req_duration.values.med.toFixed(2)}ms\n`;
  summary += `90th Percentile: ${metrics.http_req_duration.values['p(90)'].toFixed(2)}ms\n`;
  summary += `95th Percentile: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `99th Percentile: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  summary += `Max Response Time: ${metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;
  
  // Throughput
  summary += '🚀 THROUGHPUT\n';
  summary += '-'.repeat(70) + '\n';
  summary += `Requests/sec: ${metrics.http_reqs.values.rate.toFixed(2)}\n`;
  summary += `Data Received: ${(metrics.data_received.values.count / 1024 / 1024).toFixed(2)} MB\n`;
  summary += `Data Sent: ${(metrics.data_sent.values.count / 1024 / 1024).toFixed(2)} MB\n`;
  summary += `Data Received/sec: ${(metrics.data_received.values.rate / 1024).toFixed(2)} KB/s\n`;
  summary += `Data Sent/sec: ${(metrics.data_sent.values.rate / 1024).toFixed(2)} KB/s\n\n`;
  
  // System Health
  summary += '🏥 SYSTEM HEALTH\n';
  summary += '-'.repeat(70) + '\n';
  summary += `Average Health Score: ${metrics.system_health_score.values.value.toFixed(2)}%\n`;
  summary += `HTTP Failures: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;
  
  // Thresholds Check
  summary += '🎯 THRESHOLD STATUS\n';
  summary += '-'.repeat(70) + '\n';
  Object.entries(data.root_group.checks || {}).forEach(([name, value]) => {
    const status = value.passes === value.count ? '✓ PASS' : '✗ FAIL';
    summary += `${status}: ${name} (${value.passes}/${value.count})\n`;
  });
  
  summary += `\n${line}\n`;
  summary += 'Test completed at: ' + new Date().toISOString() + '\n';
  summary += `${line}\n`;
  
  return summary;
}
