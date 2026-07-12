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
  const url = typeof input === 'string' ? input : input?.url ?? '';
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
