/**
 * K6 Minikube Health Check Test
 * Tests health endpoints via port-forwarded services
 * 
 * Prerequisites:
 * - kubectl port-forward svc/user-service 81:3000
 * - kubectl port-forward svc/trip-service 82:3000
 * - kubectl port-forward svc/traefik 8080:8080 8000:80
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const successRate = new Rate('success_rate');
const healthCheckDuration = new Trend('health_check_duration');
const errorCount = new Counter('error_count');

// Test configuration - Quick health check (2 minutes)
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Warm up
    { duration: '1m', target: 50 },    // Ramp up
    { duration: '30s', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<600'],
    success_rate: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
  },
};

// Minikube port-forwarded endpoints
const MINIKUBE_SERVICES = {
  'User Service': 'http://localhost:83/health',
  'Trip Service': 'http://localhost:82/health',
  'Traefik Dashboard': 'http://localhost:8080/api/http/routers',
};

export function setup() {
  console.log('=== K6 Minikube Health Test Setup ===');
  console.log('Testing port-forwarded services:');
  console.log('  - User Service: http://localhost:83');
  console.log('  - Trip Service: http://localhost:82');
  console.log('  - Traefik: http://localhost:8080');
  console.log('');
  
  // Verify all services are accessible
  let allHealthy = true;
  
  Object.entries(MINIKUBE_SERVICES).forEach(([name, url]) => {
    const response = http.get(url, { timeout: '10s' });
    const healthy = response.status === 200;
    console.log(`${name}: ${healthy ? '✅ OK' : '❌ FAILED'} (${response.status})`);
    if (!healthy) allHealthy = false;
  });
  
  if (!allHealthy) {
    console.error('⚠️  Some services are not healthy! Check port-forwards are running.');
  }
  
  return { servicesHealthy: allHealthy };
}

export default function (data) {
  // Test each service
  Object.entries(MINIKUBE_SERVICES).forEach(([name, url]) => {
    group(name, () => {
      const startTime = Date.now();
      const response = http.get(url, {
        tags: { service: name },
        timeout: '5s',
      });
      const duration = Date.now() - startTime;

      healthCheckDuration.add(duration);

      const success = check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 300ms': (r) => r.timings.duration < 300,
        'has response body': (r) => r.body && r.body.length > 0,
      });

      successRate.add(success);
      
      if (!success) {
        errorCount.add(1);
        console.error(`${name} health check failed: ${response.status}`);
      }
    });
  });

  sleep(1);
}

export function teardown(data) {
  console.log('\n=== K6 Minikube Health Test Teardown ===');
  console.log('Test completed');
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  return {
    [`test/load-tests/results/minikube-health-${timestamp}.json`]: JSON.stringify(data, null, 2),
    'stdout': generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  const line = '='.repeat(70);
  
  let summary = `\n${line}\n`;
  summary += '🚀 MINIKUBE HEALTH CHECK TEST SUMMARY\n';
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
  summary += `Avg Response Time: ${(metrics.http_req_duration?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `Min Response Time: ${(metrics.http_req_duration?.values.min || 0).toFixed(2)}ms\n`;
  summary += `Max Response Time: ${(metrics.http_req_duration?.values.max || 0).toFixed(2)}ms\n`;
  summary += `Median (p50): ${(metrics.http_req_duration?.values.med || 0).toFixed(2)}ms\n`;
  summary += `p90: ${(metrics.http_req_duration?.values['p(90)'] || 0).toFixed(2)}ms\n`;
  summary += `p95: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `p99: ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms\n\n`;
  
  summary += '🚀 THROUGHPUT\n';
  summary += '-'.repeat(70) + '\n';
  summary += `Requests/sec: ${(metrics.http_reqs?.values.rate || 0).toFixed(2)}\n`;
  summary += `Data Received: ${((metrics.data_received?.values.count || 0) / 1024).toFixed(2)} KB\n`;
  summary += `Data Sent: ${((metrics.data_sent?.values.count || 0) / 1024).toFixed(2)} KB\n\n`;
  
  summary += '🎯 THRESHOLD STATUS\n';
  summary += '-'.repeat(70) + '\n';
  
  const thresholds = {
    'p95 < 300ms': (metrics.http_req_duration?.values['p(95)'] || 0) < 300,
    'p99 < 600ms': (metrics.http_req_duration?.values['p(99)'] || 0) < 600,
    'Success rate > 95%': (metrics.success_rate?.values.rate || 0) > 0.95,
    'Error rate < 5%': (metrics.http_req_failed?.values.rate || 0) < 0.05,
  };
  
  Object.entries(thresholds).forEach(([name, passed]) => {
    const emoji = passed ? '✅' : '❌';
    summary += `${emoji} ${name}\n`;
  });
  
  summary += `\n${line}\n`;
  summary += `Test completed at: ${new Date().toISOString()}\n`;
  summary += `${line}\n`;
  
  return summary;
}
