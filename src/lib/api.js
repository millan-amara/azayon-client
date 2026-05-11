import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - handle 401 and refresh token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Attempt a refresh on ANY 401 from an authenticated request, not
    // just `code: TOKEN_EXPIRED`. Signature-mismatch 401s (e.g. after a
    // deploy that rotated JWT_SECRET, or any other JWT verify failure)
    // also come through here — previously those would just reject and
    // leave the user stuck on broken pages until they manually re-logged
    // in. Auth endpoints are excluded so a wrong-password login attempt
    // doesn't kick off a refresh-then-redirect loop on the login screen.
    const url = originalRequest?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint &&
      localStorage.getItem('accessToken')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newToken = data.accessToken;
        localStorage.setItem('accessToken', newToken);
        api.defaults.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Surfaces *why* the refresh failed so a forced logout is
        // diagnosable from the browser console (rate limit / expired
        // refresh cookie / network / etc) instead of just appearing random.
        // eslint-disable-next-line no-console
        console.error('[auth] forced logout — refresh failed', {
          status: refreshError?.response?.status,
          data: refreshError?.response?.data,
          originalUrl: originalRequest?.url,
        });
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Download a file from an API endpoint and trigger the browser's save dialog.
// Uses the same auth/refresh pipeline as regular requests.
export async function downloadFile(path, { params, filename } = {}) {
  const { data, headers } = await api.get(path, { params, responseType: 'blob' });

  // Try to read filename from Content-Disposition; fall back to provided name.
  let name = filename || 'download';
  const cd = headers['content-disposition'] || headers['Content-Disposition'];
  if (cd) {
    const match = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if (match) name = decodeURIComponent(match[1]);
  }

  const url = window.URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default api;