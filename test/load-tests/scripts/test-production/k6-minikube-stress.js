/**
 * K6 Minikube Stress Test
 * Extended stress test for Minikube deployment
 * 
 * Prerequisites:
 * - kubectl port-forward svc/user-service 81:3000
 * - kubectl port-forward svc/trip-service 82:3000
 * - kubectl port-forward svc/traefik 8080:8080 8000:80
 * 
 * Duration: 5 minutes
 * Load: 50 → 200 concurrent users
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const successRate = new Rate('success_rate');
const healthCheckDuration = new Trend('health_check_duration');
const errorCount = new Counter('error_count');
const userServiceMetric = new Trend('user_service_duration');
const tripServiceMetric = new Trend('trip_service_duration');

// Test configuration - 5 minute stress test
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Warm up to 50 users
    { duration: '1m', target: 100 },   // Ramp to 100 users
    { duration: '2m', target: 200 },   // Ramp to 200 users (peak)
    { duration: '1m', target: 200 },   // Hold at peak
    { duration: '30s', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<800'],
    success_rate: ['rate>0.90'],
    http_req_failed: ['rate<0.10'],
    user_service_duration: ['p(95)<350'],
    trip_service_duration: ['p(95)<350'],
  },
};

// Minikube endpoints
const ENDPOINTS = {
  userService: 'http://localhost:83',
  tripService: 'http://localhost:82',
  traefik: 'http://localhost:8080',
};

export function setup() {
  console.log('=== K6 Minikube Stress Test Setup ===');
  console.log('Test configuration:');
  console.log('  - Duration: 5.5 minutes');
  console.log('  - Peak load: 200 concurrent users');
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
  
  console.log('✅ All services healthy. Starting stress test...\n');
  
  return { endpoints: ENDPOINTS };
}

export default function (data) {
  // Test User Service
  group('User Service', () => {
    const startTime = Date.now();
    const response = http.get(`${data.endpoints.userService}/health`, {
      tags: { service: 'user' },
      timeout: '5s',
    });
    const duration = Date.now() - startTime;

    userServiceMetric.add(duration);
    healthCheckDuration.add(duration);

    const success = check(response, {
      'user service status 200': (r) => r.status === 200,
      'user service response < 350ms': (r) => r.timings.duration < 350,
      'user service has body': (r) => r.body && r.body.length > 0,
    });

    successRate.add(success);
    if (!success) errorCount.add(1);
  });

  // Test Trip Service
  group('Trip Service', () => {
    const startTime = Date.now();
    const response = http.get(`${data.endpoints.tripService}/health`, {
      tags: { service: 'trip' },
      timeout: '5s',
    });
    const duration = Date.now() - startTime;

    tripServiceMetric.add(duration);
    healthCheckDuration.add(duration);

    const success = check(response, {
      'trip service status 200': (r) => r.status === 200,
      'trip service response < 350ms': (r) => r.timings.duration < 350,
      'trip service has body': (r) => r.body && r.body.length > 0,
    });

    successRate.add(success);
    if (!success) errorCount.add(1);
  });

  // Test Traefik API
  group('Traefik API', () => {
    const response = http.get(`${data.endpoints.traefik}/api/http/routers`, {
      tags: { service: 'traefik' },
      timeout: '5s',
    });

    const success = check(response, {
      'traefik status 200': (r) => r.status === 200,
      'traefik has routers': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) || typeof body === 'object';
        } catch {
          return false;
        }
      },
    });

    successRate.add(success);
    if (!success) errorCount.add(1);
  });

  sleep(0.5); // Shorter sleep for more aggressive testing
}

export function teardown(data) {
  console.log('\n=== K6 Minikube Stress Test Teardown ===');
  console.log('Test completed successfully');
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  return {
    [`test/load-tests/results/minikube-stress-${timestamp}.json`]: JSON.stringify(data, null, 2),
    'stdout': generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  const line = '='.repeat(70);
  
  let summary = `\n${line}\n`;
  summary += '🔥 MINIKUBE STRESS TEST SUMMARY\n';
  summary += `${line}\n\n`;
  
  summary += '📊 TEST OVERVIEW\n';
  summary += '-'.repeat(70) + '\n';
  summary += `Duration: ${(data.state.testRunDurationMs / 1000).toFixed(2)}s\n`;
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
    'p95 < 400ms': (metrics.http_req_duration?.values['p(95)'] || 0) < 400,
    'p99 < 800ms': (metrics.http_req_duration?.values['p(99)'] || 0) < 800,
    'Success rate > 90%': (metrics.success_rate?.values.rate || 0) > 0.90,
    'Error rate < 10%': (metrics.http_req_failed?.values.rate || 0) < 0.10,
    'User Service p95 < 350ms': (metrics.user_service_duration?.values['p(95)'] || 0) < 350,
    'Trip Service p95 < 350ms': (metrics.trip_service_duration?.values['p(95)'] || 0) < 350,
  };
  
  Object.entries(thresholds).forEach(([name, passed]) => {
    const emoji = passed ? '✅' : '❌';
    summary += `${emoji} ${name}\n`;
  });
  
  summary += `\n${line}\n`;
  summary += `🏆 PEAK LOAD: 200 concurrent users\n`;
  summary += `📊 Total Duration: ${(data.state.testRunDurationMs / 1000 / 60).toFixed(1)} minutes\n`;
  summary += `Test completed at: ${new Date().toISOString()}\n`;
  summary += `${line}\n`;
  
  return summary;
}
