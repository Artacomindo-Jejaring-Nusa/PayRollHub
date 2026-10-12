import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { BASE_URL, JSON_HEADERS, DUMMY_PHOTO_BASE64 } from '../config.js';

// Custom Metrik Tambahan
const checkInTrend = new Trend('check_in_response_time');
const successfulCheckIns = new Counter('successful_checkins');
const failedCheckIns = new Counter('failed_checkins');

const users = new SharedArray('users', function () {
  return JSON.parse(open('../fixtures/users.json'));
});

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Fase 1: 50 VU (Beban ringan)
    { duration: '1m',  target: 150 },  // Fase 2: 150 VU (Beban normal)
    { duration: '1m',  target: 300 },  // Fase 3: 300 VU (Beban puncak)
    { duration: '1m',  target: 500 },  // Fase 4: 500 VU (Beban ekstrim / Stress limit)
    { duration: '30s', target: 0 },    // Pendinginan
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Maksimal 5% toleransi kegagalan pada stress ekstrim
    'check_in_response_time': ['p(95)<3500'],
  },
};

export default function () {
  const user = users[(__VU - 1) % users.length];

  // 1. Login
  const loginRes = http.post(
    `${BASE_URL}/login`,
    JSON.stringify({
      identifier: user.identifier,
      password: user.password,
      company: user.company,
    }),
    { headers: JSON_HEADERS }
  );

  if (loginRes.status !== 200) {
    failedCheckIns.add(1);
    sleep(1);
    return;
  }

  const token = JSON.parse(loginRes.body).data.token;
  const authHeaders = Object.assign({}, JSON_HEADERS, {
    Authorization: `Bearer ${token}`,
  });

  // 2. Cek Status Absen Hari ini
  http.get(`${BASE_URL}/employee/attendance/today`, { headers: authHeaders });

  // 3. Eksekusi Check-In Bersamaan
  const startTime = Date.now();
  const checkInRes = http.post(
    `${BASE_URL}/employee/attendance/check-in`,
    JSON.stringify({
      attendance_type: 'dinas_luar',
      notes: 'Stress Test Concurrency',
      latitude: -6.2088,
      longitude: 106.8456,
      photo: DUMMY_PHOTO_BASE64,
    }),
    { headers: authHeaders }
  );
  checkInTrend.add(Date.now() - startTime);

  const isOk = check(checkInRes, {
    'Check-in Responsif (200 / 422)': (r) => r.status === 200 || r.status === 422,
  });

  if (isOk) {
    successfulCheckIns.add(1);
  } else {
    failedCheckIns.add(1);
  }

  sleep(Math.random() * 2 + 0.5);
}
