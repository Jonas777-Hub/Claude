// Web-Vorschau ohne Server (Build mit VITE_STATIC=1): Bilder liegen lokal, Server-Funktionen sind aus.
export const STATIC = typeof import.meta !== 'undefined' && !!import.meta.env?.VITE_STATIC
