// Web-Version ohne Server (Build mit VITE_STATIC=1): Server-Funktionen (Konto, Teilen) sind aus.
// LOCAL_IMAGES: Bilder liegen neben der Seite (claude.ai-Artifact, dort sind fremde Bildquellen gesperrt).
// Für GitHub Pages (VITE_REMOTE_IMAGES=1) werden die Originalfotos direkt von TheMealDB geladen.
const env = typeof import.meta !== 'undefined' ? import.meta.env || {} : {}
export const STATIC = !!env.VITE_STATIC
export const LOCAL_IMAGES = STATIC && !env.VITE_REMOTE_IMAGES
