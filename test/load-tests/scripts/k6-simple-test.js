/**
 * K6 Simple Load Test - No Authentication Required
 * Quick test để verify hệ thống có thể handle load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const successRate = new Rate('success_rate');
const responseDuration = new Trend('response_duration');

// Test configuration - simple smoke test
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Warm up
    { duration: '1m', target: 50 },   // Ramp to 50 users
    { duration: '30s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    success_rate: ['rate>0.95'],
  },
};

// Test các service health endpoints
const SERVICES = [
  'http://127.0.0.1:81',  // Traefik (không cần Host header cho health)
];

export default function () {
  // Test health endpoint
  const response = http.get('http://127.0.0.1:8080/api/http/routers', {
    tags: { name: 'TraefikAPI' },
  });

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  responseDuration.add(response.timings.duration);
  successRate.add(success);

  if (!success) {
    console.error(`Request failed: ${response.status}`);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  
  let summary = '\n========================================\n';
  summary += 'SIMPLE LOAD TEST SUMMARY\n';
  summary += '========================================\n\n';
  
  summary += `Total Requests: ${metrics.http_reqs?.values.count || 0}\n`;
  summary += `Success Rate: ${((metrics.success_rate?.values.rate || 0) * 100).toFixed(2)}%\n`;
  summary += `Avg Response Time: ${(metrics.http_req_duration?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `p95 Response Time: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms\n\n`;
  
  summary += '========================================\n';
  
  return summary;
}
