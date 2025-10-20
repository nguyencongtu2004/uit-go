/**
 * K6 Load Test - Driver Location Updates
 * Target: 10,000+ location updates per second
 * Scenario: Simulate 1000 drivers updating location every 5 seconds
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const locationUpdateRate = new Rate('location_update_success');
const locationUpdateDuration = new Trend('location_update_duration');
const locationUpdateErrors = new Counter('location_update_errors');

// Load test configuration
export const options = {
  scenarios: {
    // Warm-up phase
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 }, // Ramp up to 100 drivers
      ],
      gracefulRampDown: '10s',
      exec: 'driverLocationUpdate',
      startTime: '0s',
    },
    // Main load test
    location_updates: {
      executor: 'constant-vus',
      vus: 1000, // 1000 concurrent drivers
      duration: '5m', // 5 minutes sustained load
      exec: 'driverLocationUpdate',
      startTime: '40s', // Start after warm-up
    },
    // Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 1000,
      stages: [
        { duration: '10s', target: 2000 }, // Spike to 2000 drivers
        { duration: '30s', target: 2000 }, // Hold spike
        { duration: '10s', target: 1000 }, // Return to normal
      ],
      gracefulRampDown: '10s',
      exec: 'driverLocationUpdate',
      startTime: '6m', // Start after main test
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<200'], // 95% < 100ms, 99% < 200ms
    location_update_success: ['rate>0.99'], // 99% success rate
    http_req_failed: ['rate<0.01'], // Less than 1% errors
  },
};

// Ho Chi Minh City coordinates boundaries
const HCMC_BOUNDS = {
  lat: { min: 10.7, max: 10.85 },
  lng: { min: 106.6, max: 106.75 },
};

// Generate random location within HCMC
function generateLocation() {
  return {
    latitude: HCMC_BOUNDS.lat.min + Math.random() * (HCMC_BOUNDS.lat.max - HCMC_BOUNDS.lat.min),
    longitude: HCMC_BOUNDS.lng.min + Math.random() * (HCMC_BOUNDS.lng.max - HCMC_BOUNDS.lng.min),
  };
}

// Load test data from file
let testData;
try {
  testData = JSON.parse(open('../test-data/tokens-only.json'));
} catch (e) {
  console.error('Failed to load test data:', e);
  testData = { driverTokens: {} };
}

const driverTokens = Object.values(testData.driverTokens || {});
const BASE_URL = __ENV.DRIVER_SERVICE_URL || 'http://driver.localhost:81';

export function setup() {
  console.log('=== K6 Load Test Setup ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Total driver tokens: ${driverTokens.length}`);
  console.log(`Target: 1000 concurrent drivers`);
  console.log(`Test duration: 5 minutes + spike test`);
  
  // Verify service health
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Service health check failed: ${healthCheck.status}`);
  }
  
  return { driverTokens, baseUrl: BASE_URL };
}

export function driverLocationUpdate(data) {
  const driverIndex = __VU % driverTokens.length;
  const token = driverTokens[driverIndex];
  
  if (!token) {
    console.error(`No token available for VU ${__VU}`);
    return;
  }

  // Extract driverId from token or use VU number
  const driverId = `driver_${driverIndex + 1}`;
  const location = generateLocation();

  const url = `${data.baseUrl}/drivers/${driverId}/location`;
  const payload = JSON.stringify(location);
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'UpdateDriverLocation' },
  };

  const startTime = Date.now();
  const response = http.put(url, payload, params);
  const duration = Date.now() - startTime;

  // Record metrics
  locationUpdateDuration.add(duration);
  
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
    'has success field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    },
  });

  locationUpdateRate.add(success);
  
  if (!success) {
    locationUpdateErrors.add(1);
    console.error(`Location update failed for ${driverId}: ${response.status}`);
  }

  // Simulate location update every 5 seconds per driver
  sleep(5);
}

export function teardown(data) {
  console.log('=== K6 Load Test Teardown ===');
  console.log('Test completed successfully');
}

export function handleSummary(data) {
  return {
    'results/driver-location-summary.json': JSON.stringify(data, null, 2),
    'results/driver-location-summary.txt': textSummary(data, { indent: ' ', enableColors: false }),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { indent = '', enableColors = true } = options;
  const metrics = data.metrics;
  
  let summary = '\n' + indent + '='.repeat(60) + '\n';
  summary += indent + 'DRIVER LOCATION UPDATE TEST SUMMARY\n';
  summary += indent + '='.repeat(60) + '\n\n';
  
  summary += indent + `Total Requests: ${metrics.http_reqs.values.count}\n`;
  summary += indent + `Failed Requests: ${metrics.http_req_failed.values.passes}\n`;
  summary += indent + `Success Rate: ${(metrics.location_update_success.values.rate * 100).toFixed(2)}%\n\n`;
  
  summary += indent + `Response Time (avg): ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += indent + `Response Time (p95): ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += indent + `Response Time (p99): ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  summary += indent + `Requests/sec: ${metrics.http_reqs.values.rate.toFixed(2)}\n`;
  summary += indent + `Data Received: ${(metrics.data_received.values.count / 1024 / 1024).toFixed(2)} MB\n`;
  summary += indent + `Data Sent: ${(metrics.data_sent.values.count / 1024 / 1024).toFixed(2)} MB\n\n`;
  
  summary += indent + '='.repeat(60) + '\n';
  
  return summary;
}
