// ══════════════════════════════════════════════════════════════
//  CatatanKu – API Client
//  Semua komunikasi ke backend melalui file ini.
// ══════════════════════════════════════════════════════════════

// Lokal: gunakan relative /api (Express serve frontend)
// Production: ganti RAILWAY_URL dengan URL dari Railway setelah deploy
const RAILWAY_URL = 'https://gunote-production.up.railway.app/';
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '/api'
  : RAILWAY_URL + '/api';

// ─── Token helpers ────────────────────────────────────────────
const Auth = {
  getToken:   ()      => localStorage.getItem('ck_token'),
  setToken:   (t)     => localStorage.setItem('ck_token', t),
  getUser:    ()      => { try { return JSON.parse(localStorage.getItem('ck_user')); } catch { return null; } },
  setUser:    (u)     => localStorage.setItem('ck_user', JSON.stringify(u)),
  clear:      ()      => { localStorage.removeItem('ck_token'); localStorage.removeItem('ck_user'); },
  isLoggedIn: ()      => !!localStorage.getItem('ck_token'),
};

// ─── Core request ─────────────────────────────────────────────
async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token   = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  // Session expired
  if (res.status === 401) {
    Auth.clear();
    const isLoginPage = window.location.pathname.includes('login');
    if (!isLoginPage) window.location.href = '/login.html';
    throw new Error('Sesi habis, silakan login kembali');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ─── API endpoints ────────────────────────────────────────────
const API = {
  auth: {
    register: (name, email, password) =>
      apiRequest('POST', '/auth/register', { name, email, password }),
    login: (email, password) =>
      apiRequest('POST', '/auth/login', { email, password }),
    me: () =>
      apiRequest('GET', '/auth/me'),
  },

  notes: {
    getAll: ()        => apiRequest('GET',    '/notes'),
    create: (note)    => apiRequest('POST',   '/notes', note),
    update: (id, note)=> apiRequest('PUT',    `/notes/${id}`, note),
    remove: (id)      => apiRequest('DELETE', `/notes/${id}`),
  },

  reminders: {
    getAll: ()        => apiRequest('GET',    '/reminders'),
    create: (r)       => apiRequest('POST',   '/reminders', r),
    update: (id, r)   => apiRequest('PUT',    `/reminders/${id}`, r),
    remove: (id)      => apiRequest('DELETE', `/reminders/${id}`),
  },

  transactions: {
    getAll: ()        => apiRequest('GET',    '/transactions'),
    create: (t)       => apiRequest('POST',   '/transactions', t),
    update: (id, t)   => apiRequest('PUT',    `/transactions/${id}`, t),
    remove: (id)      => apiRequest('DELETE', `/transactions/${id}`),
  },
};

// ─── Auth guard (panggil di setiap halaman protected) ─────────
async function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = '/login.html';
    return null;
  }
  try {
    const user = await API.auth.me();
    Auth.setUser(user);
    return user;
  } catch {
    Auth.clear();
    window.location.href = '/login.html';
    return null;
  }
}
