import { useEffect, useState } from 'react';

const PLACEHOLDER_KEYS = new Set([
  '',
  'YOUR_GOOGLE_MAPS_API_KEY',
  'MY_GOOGLE_MAPS_API_KEY',
  'REPLACE_ME',
  'undefined',
  'null',
]);

let globalMapsAuthFailed = false;
const authFailureListeners = new Set<() => void>();

function notifyAuthFailure() {
  globalMapsAuthFailed = true;
  authFailureListeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  const prevAuthFailure = (window as unknown as { gm_authFailure?: () => void }).gm_authFailure;
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    if (typeof prevAuthFailure === 'function') {
      try {
        prevAuthFailure();
      } catch {
        // Ignore
      }
    }
    notifyAuthFailure();
  };
}

/**
 * Returns a validated Google Maps API key only if it is a real key (not a placeholder from .env.example)
 * and has not triggered gm_authFailure (InvalidKeyMapError).
 */
export function getValidGoogleMapsApiKey(): string {
  if (globalMapsAuthFailed) return '';
  const raw = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (!raw || PLACEHOLDER_KEYS.has(raw)) return '';
  // Standard Google Maps browser API keys start with "AIza" and are ~39 chars
  if (!raw.startsWith('AIza') || raw.length < 30) return '';
  return raw;
}

export function useGoogleMapsAuthStatus() {
  const [authFailed, setAuthFailed] = useState(globalMapsAuthFailed);
  const validApiKey = getValidGoogleMapsApiKey();

  useEffect(() => {
    const handler = () => setAuthFailed(true);
    authFailureListeners.add(handler);
    return () => {
      authFailureListeners.delete(handler);
    };
  }, []);

  return {
    apiKey: authFailed ? '' : validApiKey,
    hasValidKey: !authFailed && Boolean(validApiKey),
    authFailed,
    markAuthFailed: notifyAuthFailure,
  };
}
