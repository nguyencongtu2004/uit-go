/**
 * K6 Load Test - Trip Booking Flow
 * Target: 100 concurrent trip bookings
 * Scenario: Simulate passengers booking trips, drivers accepting, and completing trips
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const bookingSuccessRate = new Rate('booking_success');
const bookingDuration = new Trend('booking_duration');
const driverMatchDuration = new Trend('driver_match_duration');
const tripCompletionRate = new Rate('trip_completion_success');
const bookingErrors = new Counter('booking_errors');

// Load test data
const testData = JSON.parse(open('../test-data/tokens-only.json'));
const passengerTokens = new SharedArray('passengerTokens', function () {
  return Object.values(testData.passengerTokens || {});
});

const BASE_URL = __ENV.TRIP_SERVICE_URL || 'http://trip.localhost:81';
const DRIVER_SERVICE_URL = __ENV.DRIVER_SERVICE_URL || 'http://driver.localhost:81';

// Test configuration
export const options = {
  scenarios: {
    // Warm-up
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 }, // Ramp up slowly
      ],
      gracefulRampDown: '10s',
      exec: 'tripBookingFlow',
      startTime: '0s',
    },
    // Main booking load
    trip_booking: {
      executor: 'constant-arrival-rate',
      rate: 50, // 50 bookings per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      exec: 'tripBookingFlow',
      startTime: '40s',
    },
    // Peak hour simulation
    peak_hour: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      stages: [
        { duration: '1m', target: 100 }, // Ramp to 100 bookings/sec
        { duration: '2m', target: 100 }, // Sustain peak
        { duration: '1m', target: 50 },  // Ramp down
      ],
      preAllocatedVUs: 200,
      maxVUs: 400,
      exec: 'tripBookingFlow',
      startTime: '6m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'], // 95% < 3s, 99% < 5s
    booking_success: ['rate>0.95'], // 95% success rate
    driver_match_duration: ['p(95)<3000'], // Driver match < 3s
    trip_completion_success: ['rate>0.90'], // 90% completion
    http_req_failed: ['rate<0.05'], // Less than 5% errors
  },
};

// HCMC popular locations
const LOCATIONS = [
  { name: 'District 1', pickup: { lat: 10.7769, lng: 106.7009 }, dropoff: { lat: 10.7829, lng: 106.6960 } },
  { name: 'District 3', pickup: { lat: 10.7839, lng: 106.6897 }, dropoff: { lat: 10.7769, lng: 106.7009 } },
  { name: 'Thu Duc', pickup: { lat: 10.8495, lng: 106.7718 }, dropoff: { lat: 10.7769, lng: 106.7009 } },
  { name: 'Binh Thanh', pickup: { lat: 10.8142, lng: 106.7052 }, dropoff: { lat: 10.7829, lng: 106.6960 } },
  { name: 'Tan Binh', pickup: { lat: 10.8006, lng: 106.6541 }, dropoff: { lat: 10.7769, lng: 106.7009 } },
];

function getRandomLocation() {
  return LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
}

export function setup() {
  console.log('=== K6 Trip Booking Test Setup ===');
  console.log(`Trip Service URL: ${BASE_URL}`);
  console.log(`Driver Service URL: ${DRIVER_SERVICE_URL}`);
  console.log(`Total passenger tokens: ${passengerTokens.length}`);
  console.log(`Target: 100 concurrent trips`);
  
  // Health checks
  const tripHealth = http.get(`${BASE_URL}/health`);
  const driverHealth = http.get(`${DRIVER_SERVICE_URL}/health`);
  
  if (tripHealth.status !== 200 || driverHealth.status !== 200) {
    throw new Error('Service health check failed');
  }
  
  return { passengerTokens, baseUrl: BASE_URL, driverServiceUrl: DRIVER_SERVICE_URL };
}

export function tripBookingFlow(data) {
  const passengerIndex = __VU % passengerTokens.length;
  const token = passengerTokens[passengerIndex];
  
  if (!token) {
    console.error(`No token available for VU ${__VU}`);
    return;
  }

  const location = getRandomLocation();
  let tripId = null;

  // Step 1: Get fare estimate
  group('Fare Estimate', () => {
    const estimatePayload = JSON.stringify({
      pickup: location.pickup,
      dropoff: location.dropoff,
    });

    const estimateResponse = http.post(
      `${data.baseUrl}/booking/estimate`,
      estimatePayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'FareEstimate' },
      }
    );

    check(estimateResponse, {
      'estimate status 200': (r) => r.status === 200,
      'estimate has fare': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.estimatedFare > 0;
        } catch {
          return false;
        }
      },
    });
  });

  // Step 2: Create trip booking
  group('Create Booking', () => {
    const bookingPayload = JSON.stringify({
      pickup: location.pickup,
      dropoff: location.dropoff,
      pickupAddress: `${location.name} - Pickup`,
      dropoffAddress: `${location.name} - Dropoff`,
    });

    const startTime = Date.now();
    const bookingResponse = http.post(
      `${data.baseUrl}/trips`,
      bookingPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'CreateBooking' },
      }
    );
    const duration = Date.now() - startTime;

    bookingDuration.add(duration);

    const bookingSuccess = check(bookingResponse, {
      'booking status 201': (r) => r.status === 201,
      'booking has tripId': (r) => {
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

    bookingSuccessRate.add(bookingSuccess);

    if (!bookingSuccess) {
      bookingErrors.add(1);
      return; // Exit if booking failed
    }
  });

  // Step 3: Wait for driver matching (simulate WebSocket updates)
  group('Driver Matching', () => {
    if (!tripId) return;

    const matchStartTime = Date.now();
    let matched = false;
    let attempts = 0;
    const maxAttempts = 6; // 30 seconds max (5s * 6)

    while (!matched && attempts < maxAttempts) {
      sleep(5); // Check every 5 seconds
      attempts++;

      const statusResponse = http.get(
        `${data.baseUrl}/trips/${tripId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          tags: { name: 'CheckTripStatus' },
        }
      );

      if (statusResponse.status === 200) {
        try {
          const body = JSON.parse(statusResponse.body);
          if (body.data && body.data.status === 'accepted') {
            matched = true;
            const matchDuration = Date.now() - matchStartTime;
            driverMatchDuration.add(matchDuration);
          }
        } catch (e) {
          // Continue waiting
        }
      }
    }

    check(matched, {
      'driver matched within 30s': (m) => m === true,
    });
  });

  // Step 4: Complete trip (simulate trip progress)
  group('Complete Trip', () => {
    if (!tripId) return;

    sleep(10); // Simulate trip duration

    const completeResponse = http.patch(
      `${data.baseUrl}/trips/${tripId}/status`,
      JSON.stringify({ status: 'completed' }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'CompleteTrip' },
      }
    );

    const completed = check(completeResponse, {
      'trip completed successfully': (r) => r.status === 200,
    });

    tripCompletionRate.add(completed);
  });

  // Random delay between trips
  sleep(Math.random() * 5 + 5); // 5-10 seconds
}

export function teardown(data) {
  console.log('=== K6 Trip Booking Test Teardown ===');
  console.log('Test completed successfully');
}

export function handleSummary(data) {
  return {
    'results/trip-booking-summary.json': JSON.stringify(data, null, 2),
    'results/trip-booking-summary.txt': textSummary(data, { indent: ' ', enableColors: false }),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { indent = '', enableColors = true } = options;
  const metrics = data.metrics;
  
  let summary = '\n' + indent + '='.repeat(60) + '\n';
  summary += indent + 'TRIP BOOKING TEST SUMMARY\n';
  summary += indent + '='.repeat(60) + '\n\n';
  
  summary += indent + `Total Requests: ${metrics.http_reqs.values.count}\n`;
  summary += indent + `Booking Success Rate: ${(metrics.booking_success.values.rate * 100).toFixed(2)}%\n`;
  summary += indent + `Trip Completion Rate: ${(metrics.trip_completion_success.values.rate * 100).toFixed(2)}%\n\n`;
  
  summary += indent + `Booking Duration (avg): ${metrics.booking_duration.values.avg.toFixed(2)}ms\n`;
  summary += indent + `Driver Match Duration (avg): ${metrics.driver_match_duration.values.avg.toFixed(2)}ms\n`;
  summary += indent + `Response Time (p95): ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n\n`;
  
  summary += indent + `Requests/sec: ${metrics.http_reqs.values.rate.toFixed(2)}\n`;
  summary += indent + `Booking Errors: ${metrics.booking_errors.values.count}\n\n`;
  
  summary += indent + '='.repeat(60) + '\n';
  
  return summary;
}
