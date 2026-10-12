import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS } from '../config.js';

export const options = {
  vus: 5,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  // 1. Test Public Endpoint
  const templateRes = http.get(`${BASE_URL}/attendance-locations/template`);
  check(templateRes, {
    'Download template status 200': (r) => r.status === 200,
  });

  // 2. Test Login Admin
  const loginPayload = JSON.stringify({
    email: 'admin@payrollhub.com',
    password: 'password123',
  });

  const loginRes = http.post(`${BASE_URL}/login`, loginPayload, {
    headers: JSON_HEADERS,
  });

  const loginOk = check(loginRes, {
    'Login Admin status 200': (r) => r.status === 200,
    'Login Admin dapat token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.token;
      } catch (e) {
        return false;
      }
    },
  });

  if (loginOk) {
    const token = JSON.parse(loginRes.body).data.token;
    const authHeaders = Object.assign({}, JSON_HEADERS, {
      Authorization: `Bearer ${token}`,
    });

    // 3. Test Auth Endpoint: /me
    const meRes = http.get(`${BASE_URL}/me`, { headers: authHeaders });
    check(meRes, {
      'Get /me status 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
