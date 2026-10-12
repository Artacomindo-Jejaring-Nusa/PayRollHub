// Configuration & Shared Helpers for k6 Load Testing
export const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000/api';

// Standard HTTP Headers
export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// 1x1 Blank JPEG Base64 for fast selfie payload simulation
export const DUMMY_PHOTO_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

// Standard SLA Thresholds
export const STANDARD_THRESHOLDS = {
  http_req_failed: ['rate<0.01'], // Kegagalan request harus < 1%
  http_req_duration: ['p(95)<1500', 'p(99)<2500'], // 95% request selesai < 1.5 detik
};
