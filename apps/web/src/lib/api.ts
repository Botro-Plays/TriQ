import axios from 'axios';

const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('triq-auth');
  if (token) {
    try {
      const parsed = JSON.parse(token);
      if (parsed?.state?.token) {
        config.headers.Authorization = `Bearer ${parsed.state.token}`;
      }
    } catch {}
  }
  return config;
});
