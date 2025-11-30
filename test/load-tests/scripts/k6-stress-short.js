/**
 * K6 Short Stress Test (2 minutes)
 * Quick stress test for all services
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const successRate = new Rate('success_rate');
const healthCheckDuration = new Trend('health_check_duration');
const errorCount = new Counter('error_count');

// Test configuration - 2 minutes total
export const options = {
  stages: [
    { duration: '20s', target: 50 },   // Warm up
    { duration: '40s', target: 200 },  // Ramp up
    { duration: '40s', target: 200 },  // Hold
    { duration: '20s', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    success_rate: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
  },
};

const SERVICES = {
  'User Service': 'http://user.localhost:81/health',
  'Driver Service': 'http://driver.localhost:81/health',
  'Trip Service': 'http://trip.localhost:81/health',
};

export default function () {
  // Test each service
  Object.entries(SERVICES).forEach(([name, url]) => {
    group(name, () => {
      const startTime = Date.now();
      const response = http.get(url, {
        tags: { service: name },
      });
      const duration = Date.now() - startTime;

      healthCheckDuration.add(duration);

      const success = check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
        'has valid JSON': (r) => {
          if (r.status !== 200) return false;
          if (!r.body) return false;
          
          try {
            const body = JSON.parse(r.body);
            return typeof body === 'object' && body !== null && (
              body.status === 'OK' || 
              body.status === 'DEGRADED' || 
              body.service !== undefined
            );
          } catch (e) {
            return false;
          }
        },
      });

      successRate.add(success);
      
      if (!success) {
        errorCount.add(1);
      }
    });
  });

  sleep(0.5); // Shorter sleep for more aggressive testing
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  return {
    [`test/load-tests/results/stress-${timestamp}.json`]: JSON.stringify(data, null, 2),
    'stdout': generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  const line = '='.repeat(70);
  
  let summary = `\n${line}\n`;
  summary += 'UIT-GO STRESS TEST SUMMARY (2-MINUTE RUN)\n';
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
  summary += `Data Received: ${((metrics.data_received?.values.count || 0) / 1024 / 1024).toFixed(2)} MB\n`;
  summary += `Data Sent: ${((metrics.data_sent?.values.count || 0) / 1024).toFixed(2)} KB\n\n`;
  
  summary += '🎯 THRESHOLD STATUS\n';
  summary += '-'.repeat(70) + '\n';
  
  const thresholds = {
    'p95 < 200ms': (metrics.http_req_duration?.values['p(95)'] || 0) < 200,
    'p99 < 500ms': (metrics.http_req_duration?.values['p(99)'] || 0) < 500,
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
