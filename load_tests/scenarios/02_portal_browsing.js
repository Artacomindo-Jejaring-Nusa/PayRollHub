import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { BASE_URL, JSON_HEADERS } from '../config.js';

const users = new SharedArray('users', function () {
  return JSON.parse(open('../fixtures/users.json'));
});

export const options = {
  stages: [
    { duration: '15s', target: 20 },  // Ramp-up 20 VUs
    { duration: '30s', target: 50 },  // 50 VUs browsing slip gaji & dashboard
    { duration: '15s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const user = users[(__VU - 1) % users.length];

  // 1. Login
  const loginPayload = JSON.stringify({
    identifier: user.identifier,
    password: user.password,
    company: user.company,
  });

  const loginRes = http.post(`${BASE_URL}/login`, loginPayload, {
    headers: JSON_HEADERS,
  });

  if (loginRes.status !== 200) {
    sleep(1);
    return;
  }

  const token = JSON.parse(loginRes.body).data.token;
  const authHeaders = Object.assign({}, JSON_HEADERS, {
    Authorization: `Bearer ${token}`,
  });

  // 2. Akses Employee Dashboard
  const dashRes = http.get(`${BASE_URL}/employee/dashboard`, {
    headers: authHeaders,
  });
  check(dashRes, {
    'GET Employee Dashboard (200)': (r) => r.status === 200,
  });

  sleep(1);

  // 3. Akses Daftar Slip Gaji (Payrolls)
  const payrollsRes = http.get(`${BASE_URL}/employee/payrolls`, {
    headers: authHeaders,
  });
  check(payrollsRes, {
    'GET Daftar Slip Gaji (200)': (r) => r.status === 200,
  });

  sleep(1);

  // 4. Akses Riwayat Absensi
  const historyRes = http.get(`${BASE_URL}/employee/attendance/history`, {
    headers: authHeaders,
  });
  check(historyRes, {
    'GET Riwayat Absensi (200)': (r) => r.status === 200,
  });

  // 5. Akses Pengumuman
  const annRes = http.get(`${BASE_URL}/announcements`, {
    headers: authHeaders,
  });
  check(annRes, {
    'GET Pengumuman (200)': (r) => r.status === 200,
  });

  sleep(2);
}
