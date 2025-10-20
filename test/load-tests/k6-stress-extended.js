/**
 * K6 Extended Stress Test (5 minutes)
 * Maximum stress test with 500 concurrent users
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ✅ Custom metrics - FIX: Đảm bảo chỉ ghi số hoặc boolean
let successRate = new Rate('success_rate');
let errorRate = new Rate('error_rate');
let userServiceErrors = new Counter('user_service_errors');
let driverServiceErrors = new Counter('driver_service_errors');
let tripServiceErrors = new Counter('trip_service_errors');

export let options = {
    stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 300 },
        { duration: '1m', target: 500 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<300', 'p(99)<1000'],
        'success_rate': ['rate>0.9'], // 90% success
        'error_rate': ['rate<0.1'],   // <10% errors
    },
};

// ✅ FIX: Không cần load JSON, chỉ test health endpoints
const SERVICES = {
  'User Service': 'http://user.localhost:81/health',
  'Driver Service': 'http://driver.localhost:81/health',
  'Trip Service': 'http://trip.localhost:81/health',
};

export default function () {
    // ✅ FIX: Khởi tạo biến tracking
    let hasError = false;
    let isSuccess = true;

    // Test User Service
    const userHealthRes = http.get('http://user.localhost:81/health');
    const userHealthOk = check(userHealthRes, {
        'User service healthy': (r) => r.status === 200,
    });
    
    // ✅ FIX: Chỉ ghi boolean/number vào metrics
    if (!userHealthOk) {
        userServiceErrors.add(1);
        hasError = true;
        isSuccess = false;
    }

    // Test Driver Service
    const driverHealthRes = http.get('http://driver.localhost:81/health');
    const driverHealthOk = check(driverHealthRes, {
        'Driver service healthy': (r) => r.status === 200,
    });
    
    if (!driverHealthOk) {
        driverServiceErrors.add(1);
        hasError = true;
        isSuccess = false;
    }

    // Test Trip Service
    const tripHealthRes = http.get('http://trip.localhost:81/health');
    const tripHealthOk = check(tripHealthRes, {
        'Trip service healthy': (r) => r.status === 200,
    });
    
    if (!tripHealthOk) {
        tripServiceErrors.add(1);
        hasError = true;
        isSuccess = false;
    }

    // ✅ FIX: Ghi metrics với giá trị boolean rõ ràng
    successRate.add(isSuccess);
    errorRate.add(hasError);

    sleep(0.5); // Shorter sleep for higher load
}

export function handleSummary(data) {
    const successRateValue = data.metrics.success_rate?.values?.rate || 0;
    const errorRateValue = data.metrics.error_rate?.values?.rate || 0;
    
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}

function textSummary(data, options) {
    const metrics = data.metrics;
    const duration = (data.state.testRunDurationMs / 1000).toFixed(2);
    
    // ✅ Safe metric extraction với fallback values
    const totalRequests = metrics.http_reqs?.values?.count || 0;
    const successRateValue = (metrics.success_rate?.values?.rate || 0) * 100;
    const errorRateValue = (metrics.error_rate?.values?.rate || 0); // ✅ FIX: Thêm dòng này
    const failedRequests = metrics.http_req_failed?.values?.count || 0;
    const errorCount = (metrics.user_service_errors?.values?.count || 0) +
                      (metrics.driver_service_errors?.values?.count || 0) +
                      (metrics.trip_service_errors?.values?.count || 0);

    const avgDuration = metrics.http_req_duration?.values?.avg || 0;
    const minDuration = metrics.http_req_duration?.values?.min || 0;
    const maxDuration = metrics.http_req_duration?.values?.max || 0;
    const p50 = metrics.http_req_duration?.values['p(50)'] || 0;
    const p90 = metrics.http_req_duration?.values['p(90)'] || 0;
    const p95 = metrics.http_req_duration?.values['p(95)'] || 0;

    const rps = totalRequests / parseFloat(duration);
    const dataReceived = (metrics.data_received?.values?.count || 0) / (1024 * 1024);
    const dataSent = (metrics.data_sent?.values?.count || 0) / 1024;

    return `
======================================================================
UIT-GO EXTENDED STRESS TEST (5 MINUTES)
======================================================================

📊 TEST OVERVIEW
----------------------------------------------------------------------
Duration: ${duration}s
Total Requests: ${totalRequests}
Success Rate: ${successRateValue.toFixed(2)}%
Failed Requests: ${failedRequests}
Total Errors: ${errorCount}

⚡ PERFORMANCE METRICS
----------------------------------------------------------------------
Avg Response Time: ${avgDuration.toFixed(2)}ms
Min Response Time: ${minDuration.toFixed(2)}ms
Max Response Time: ${maxDuration.toFixed(2)}ms
Median (p50): ${p50.toFixed(2)}ms
p90: ${p90.toFixed(2)}ms
p95: ${p95.toFixed(2)}ms

🚀 THROUGHPUT
----------------------------------------------------------------------
Requests/sec: ${rps.toFixed(2)}
Data Received: ${dataReceived.toFixed(2)} MB
Data Sent: ${dataSent.toFixed(2)} KB

🔍 ERROR BREAKDOWN
----------------------------------------------------------------------
User Service Errors: ${metrics.user_service_errors?.values?.count || 0}
Driver Service Errors: ${metrics.driver_service_errors?.values?.count || 0}
Trip Service Errors: ${metrics.trip_service_errors?.values?.count || 0}

🎯 THRESHOLD STATUS
----------------------------------------------------------------------
${p95 < 300 ? '✅' : '❌'} p95 < 300ms
${metrics.http_req_duration?.values['p(99)'] < 1000 ? '✅' : '❌'} p99 < 1000ms
${successRateValue > 90 ? '✅' : '❌'} Success rate > 90%
${errorRateValue < 0.1 ? '✅' : '❌'} Error rate < 10%

======================================================================
Peak Concurrent Users: 500 VUs
Test completed at: ${new Date().toISOString()}
======================================================================
`;
}
