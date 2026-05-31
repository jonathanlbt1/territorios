/**
 * Get the full URL for a map file
 * In production (Vercel), maps are served from the backend (Render)
 * In local dev, maps are proxied via nginx at /maps/
 */
export function getMapUrl(filename) {
  if (!filename) return '';
  
  const encodedFilename = encodeURIComponent(filename);
  const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL;
  
  // If we have a full API URL (production), use it to serve maps
  if (apiBaseUrl && apiBaseUrl.startsWith('http')) {
    // Remove /api suffix if present and add /maps/
    const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
    return `${baseUrl}/maps/${encodedFilename}`;
  }
  
  // Local development: use nginx proxy
  return `/maps/${encodedFilename}`;
}
