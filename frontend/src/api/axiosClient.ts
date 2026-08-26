import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'kanban_token';

/**
 * Axios instance pre-configured for the Spring Boot backend.
 *
 * - baseURL: `/api` → Vite proxy forwards to http://localhost:8080/api in dev
 *                      Nginx proxy in production (see frontend/Dockerfile)
 * - Request interceptor: attaches stored JWT as Bearer token
 * - Response interceptor: redirects to /login on 401
 */
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

/* ── Request: attach Bearer token ─────────────────────────────────── */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ── Response: handle global 401 ─────────────────────────────────── */
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      // Hard redirect – clears React state automatically
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export { TOKEN_KEY };
export default api;
