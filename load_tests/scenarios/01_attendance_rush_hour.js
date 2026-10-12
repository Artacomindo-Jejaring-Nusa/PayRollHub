import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { BASE_URL, JSON_HEADERS, DUMMY_PHOTO_BASE64 } from '../config.js';

// Muat daftar kredensial karyawan dari fixtures/users.json
const users = new SharedArray('users', function () {
  return JSON.parse(open('../fixtures/users.json'));
});

export const options = {
  stages: [
    { duration: '20s', target: 20 },  // Ramp-up ke 20 pengguna serentak
    { duration: '40s', target: 50 },  // Naik ke 50 pengguna serentak (Jam sibuk 06:45)
    { duration: '40s', target: 100 }, // Puncak jam sibuk 100 VU (07:00 pagi)
    { duration: '20s', target: 0 },   // Ramp-down pendinginan
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Tingkat error kegagalan HTTP < 5%
    http_req_duration: ['p(95)<3000'], // 95% request selesai di bawah 3 detik
  },
};

export default function () {
  // Ambil user unik berdasarkan index Virtual User (VU)
  const userIndex = (__VU - 1) % users.length;
  const user = users[userIndex];

  // 1. Karyawan Melakukan Login
  const loginPayload = JSON.stringify({
    identifier: user.identifier,
    password: user.password,
    company: user.company,
  });

  const loginRes = http.post(`${BASE_URL}/login`, loginPayload, {
    headers: JSON_HEADERS,
  });

  const loginSuccess = check(loginRes, {
    'Login Karyawan Berhasil': (r) => r.status === 200,
  });

  if (!loginSuccess) {
    sleep(1);
    return;
  }

  const token = JSON.parse(loginRes.body).data.token;
  const authHeaders = Object.assign({}, JSON_HEADERS, {
    Authorization: `Bearer ${token}`,
  });

  // 2. Karyawan Membuka Halaman Absensi (Cek Status Hari Ini & Daftar Lokasi)
  const todayRes = http.get(`${BASE_URL}/employee/attendance/today`, {
    headers: authHeaders,
  });

  check(todayRes, {
    'Load Status Absen Hari Ini (200)': (r) => r.status === 200,
  });

  // Jeda realistis pengguna (1 - 2 detik membaca layar sebelum tekan tombol absen)
  sleep(Math.random() * 1.5 + 0.5);

  // 3. Karyawan Menekan Tombol Absen Masuk (Check-In)
  // Kirim payload absensi dinas luar / masuk
  const checkInPayload = JSON.stringify({
    attendance_type: 'dinas_luar',
    notes: 'K6 Automated Load Test Check-in',
    latitude: -6.2088,
    longitude: 106.8456,
    photo: DUMMY_PHOTO_BASE64,
  });

  const checkInRes = http.post(
    `${BASE_URL}/employee/attendance/check-in`,
    checkInPayload,
    { headers: authHeaders }
  );

  check(checkInRes, {
    'Check-In Berhasil atau Sudah Tercatat': (r) =>
      r.status === 200 || r.status === 422, // 422 jika user sudah absen hari ini
  });

  // Waktu istirahat sebelum siklus berikutnya
  sleep(Math.random() * 2 + 1);
}
