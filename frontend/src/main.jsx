import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from './store'
import './index.css'
import App from './App.jsx'

// ── Global Fetch Interceptor ──────────────────────────────────────────────────
// Automatically attaches "Authorization: Bearer <token>" to all /api/* requests
// except the public auth routes (/api/auth/login and /api/auth/signup).
const _originalFetch = window.fetch;
window.fetch = async (input, init = {}) => {
  let url = typeof input === 'string' ? input : input?.url ?? '';
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';

  if (url.startsWith('/api/') && apiBase) {
    url = `${apiBase}${url}`;
    if (typeof input === 'string') {
      input = url;
    } else {
      input = new Request(url, input);
    }
  }

  const isApiCall = url.startsWith('/api/') || url.includes('/api/');
  const isAuthRoute = url.includes('/api/auth/');

  if (isApiCall && !isAuthRoute) {
    const token = localStorage.getItem('hids_token');
    if (token) {
      init = {
        ...init,
        headers: {
          ...init.headers,
          'Authorization': `Bearer ${token}`,
        },
      };
    }
  }

  return _originalFetch(input, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
