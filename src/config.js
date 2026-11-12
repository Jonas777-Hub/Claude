// Adresse des Kalora-KI-Servers (z. B. https://kalora.onrender.com).
// Wird beim Bauen der öffentlichen App gesetzt (VITE_API_BASE). Leer = gleiche Adresse wie die App.
export const API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/+$/, '')
