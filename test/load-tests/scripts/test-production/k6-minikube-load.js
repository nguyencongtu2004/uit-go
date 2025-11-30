/**
 * K6 Minikube Load Test
 * Simulates normal/expected production load over extended period
 * 
 * Prerequisites:
 * - kubectl port-forward svc/user-service 83:3000
 * - kubectl port-forward svc/trip-service 82:3000
 * - kubectl port-forward svc/traefik 8080:8080 8000:80
 * 
 * Purpose: Test system performance under realistic sustained load
 * Duration: 10 minutes
 * Load Pattern: Gradual ramp to 80 users, sustained for 6 minutes
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const successRate = new Rate('success_rate');
const healthCheckDuration = new Trend('health_check_duration');
const errorCount = new Counter('error_count');
const userServiceMetric = new Trend('user_service_duration');
const tripServiceMetric = new Trend('trip_service_duration');
const activeUsers = new Gauge('active_users');

// Load test configuration - 10 minute realistic load test
export const options = {
  stages: [
    { duration: '2m', target: 20 },    // Ramp up slowly
    { duration: '1m', target: 50 },    // Increase to moderate load
    { duration: '1m', target: 80 },    // Reach sustained load level
    { duration: '6m', target: 80 },    // Sustained load (main test period)
    { duration: '1m', target: 0 },     // Cool down
  ],
  thresholds: {
    // More strict thresholds for sustained load
    http_req_duration: ['p(95)<250', 'p(99)<500'],
    success_rate: ['rate>0.98'],  // Higher success rate expected for normal load
    http_req_failed: ['rate<0.02'],
    user_service_duration: ['p(95)<280'],
    trip_service_duration: ['p(95)<280'],
  },
};

// Minikube endpoints
const ENDPOINTS = {
  userService: 'http://localhost:83',
  tripService: 'http://localhost:82',
  traefik: 'http://localhost:8080',
};

export function setup() {
  console.log('=== K6 Minikube Load Test Setup ===');
  console.log('Test configuration:');
  console.log('  - Duration: 10 minutes');
  console.log('  - Sustained load: 80 concurrent users for 6 minutes');
  console.log('  - Purpose: Test normal production load');
  console.log('  - Port-forwarded endpoints');
  console.log('');
  
  // Health check all services
  console.log('Pre-flight health checks:');
  
  const userHealth = http.get(`${ENDPOINTS.userService}/health`, { timeout: '10s' });
  console.log(`  User Service: ${userHealth.status === 200 ? '✅' : '❌'} (${userHealth.status})`);
  
  const tripHealth = http.get(`${ENDPOINTS.tripService}/health`, { timeout: '10s' });
  console.log(`  Trip Service: ${tripHealth.status === 200 ? '✅' : '❌'} (${tripHealth.status})`);
  
  const traefikHealth = http.get(`${ENDPOINTS.traefik}/api/http/routers`, { timeout: '10s' });
  console.log(`  Traefik: ${traefikHealth.status === 200 ? '✅' : '❌'} (${traefikHealth.status})`);
  
  console.log('');
  
  if (userHealth.status !== 200 || tripHealth.status !== 200 || traefikHealth.status !== 200) {
    throw new Error('❌ Services are not healthy! Check port-forwards.');
  }
  
  console.log('✅ All services healthy. Starting load test...\n');
  
  return { 
    endpoints: ENDPOINTS,
    startTime: Date.now() 
  };
}

export default function (data) {
  activeUsers.add(__VU); // Track active virtual users
  
  // Simulate realistic user behavior with varied endpoints
  const scenario = Math.random();
  
  if (scenario < 0.4) {
    // 40% - User Service operations
    testUserService(data);
  } else if (scenario < 0.8) {
    // 40% - Trip Service operations
    testTripService(data);
  } else {
    // 20% - Mixed operations
    testUserService(data);
    sleep(0.5);
    testTripService(data);
  }
  
  // Realistic think time between requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

function testUserService(data) {
  group('User Service', () => {
    const startTime = Date.now();
    const response = http.get(`${data.endpoints.userService}/health`, {
      tags: { service: 'user', endpoint: 'health' },
      timeout: '5s',
    });
    const duration = Date.now() - startTime;

    userServiceMetric.add(duration);
    healthCheckDuration.add(duration);

    const success = check(response, {
      'user service status 200': (r) => r.status === 200,
      'user service response < 280ms': (r) => r.timings.duration < 280,
      'user service has body': (r) => r.body && r.body.length > 0,
    });

    successRate.add(success);
    if (!success) {
      errorCount.add(1);
      console.error(`User Service failed: ${response.status} - ${response.timings.duration}ms`);
    }
  });
}

function testTripService(data) {
  group('Trip Service', () => {
    const startTime = Date.now();
    const response = http.get(`${data.endpoints.tripService}/health`, {
      tags: { service: 'trip', endpoint: 'health' },
      timeout: '5s',
    });
    const duration = Date.now() - startTime;

    tripServiceMetric.add(duration);
    healthCheckDuration.add(duration);

    const success = check(response, {
      'trip service status 200': (r) => r.status === 200,
      'trip service response < 280ms': (r) => r.timings.duration < 280,
      'trip service has body': (r) => r.body && r.body.length > 0,
    });

    successRate.add(success);
    if (!success) {
      errorCount.add(1);
      console.error(`Trip Service failed: ${response.status} - ${response.timings.duration}ms`);
    }
  });
}

export function teardown(data) {
  const totalDuration = (Date.now() - data.startTime) / 1000 / 60;
  console.log('\n=== K6 Minikube Load Test Teardown ===');
  console.log(`Total test duration: ${totalDuration.toFixed(2)} minutes`);
  console.log('Test completed successfully');
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  return {
    [`test/load-tests/results/minikube-load-${timestamp}.json`]: JSON.stringify(data, null, 2),
    'stdout': generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  const line = '='.repeat(70);
  
  let summary = `\n${line}\n`;
  summary += '📊 MINIKUBE LOAD TEST SUMMARY\n';
  summary += `${line}\n\n`;
  
  summary += '📋 TEST OVERVIEW\n';
  summary += '-'.repeat(70) + '\n';
  summary += `Duration: ${(data.state.testRunDurationMs / 1000 / 60).toFixed(2)} minutes\n`;
  summary += `Total Requests: ${metrics.http_reqs?.values.count || 0}\n`;
  summary += `Success Rate: ${((metrics.success_rate?.values.rate || 0) * 100).toFixed(2)}%\n`;
  summary += `Failed Requests: ${metrics.http_req_failed?.values.passes || 0}\n`;
  summary += `Errors: ${metrics.error_count?.values.count || 0}\n\n`;
  
  summary += '⚡ PERFORMANCE METRICS\n';
  summary += '-'.repeat(70) + '\n';
  summary += `Overall Response Time:\n`;
  summary += `  Avg: ${(metrics.http_req_duration?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `  Min: ${(metrics.http_req_duration?.values.min || 0).toFixed(2)}ms\n`;
  summary += `  Max: ${(metrics.http_req_duration?.values.max || 0).toFixed(2)}ms\n`;
  summary += `  Median (p50): ${(metrics.http_req_duration?.values.med || 0).toFixed(2)}ms\n`;
  summary += `  p90: ${(metrics.http_req_duration?.values['p(90)'] || 0).toFixed(2)}ms\n`;
  summary += `  p95: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `  p99: ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms\n\n`;
  
  summary += '📈 SERVICE-SPECIFIC METRICS\n';
  summary += '-'.repeat(70) + '\n';
  summary += `User Service p95: ${(metrics.user_service_duration?.values['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `Trip Service p95: ${(metrics.trip_service_duration?.values['p(95)'] || 0).toFixed(2)}ms\n\n`;
  
  summary += '🚀 THROUGHPUT\n';
  summary += '-'.repeat(70) + '\n';
  summary += `Requests/sec: ${(metrics.http_reqs?.values.rate || 0).toFixed(2)}\n`;
  summary += `Data Received: ${((metrics.data_received?.values.count || 0) / 1024 / 1024).toFixed(2)} MB\n`;
  summary += `Data Sent: ${((metrics.data_sent?.values.count || 0) / 1024).toFixed(2)} KB\n\n`;
  
  summary += '🎯 THRESHOLD STATUS\n';
  summary += '-'.repeat(70) + '\n';
  
  const thresholds = {
    'p95 < 250ms': (metrics.http_req_duration?.values['p(95)'] || 0) < 250,
    'p99 < 500ms': (metrics.http_req_duration?.values['p(99)'] || 0) < 500,
    'Success rate > 98%': (metrics.success_rate?.values.rate || 0) > 0.98,
    'Error rate < 2%': (metrics.http_req_failed?.values.rate || 0) < 0.02,
    'User Service p95 < 280ms': (metrics.user_service_duration?.values['p(95)'] || 0) < 280,
    'Trip Service p95 < 280ms': (metrics.trip_service_duration?.values['p(95)'] || 0) < 280,
  };
  
  Object.entries(thresholds).forEach(([name, passed]) => {
    const emoji = passed ? '✅' : '❌';
    summary += `${emoji} ${name}\n`;
  });
  
  summary += `\n${line}\n`;
  summary += `🎯 LOAD PROFILE: 80 concurrent users sustained for 6 minutes\n`;
  summary += `📊 Total Duration: ${(data.state.testRunDurationMs / 1000 / 60).toFixed(1)} minutes\n`;
  summary += `Test completed at: ${new Date().toISOString()}\n`;
  summary += `${line}\n`;
  
  return summary;
}
