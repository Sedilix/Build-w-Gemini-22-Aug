/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified Persistent Storage Utility
 * Synchronizes key app state to both localStorage and long-lived document.cookie
 * so that settings, onboarding completion, and profile persist even across
 * browser restarts, PWA standalone launches, and storage eviction.
 */

/** Set a cookie with 1-year expiration and SameSite=Lax */
export function setCookie(name: string, value: string, days: number = 365): void {
  if (typeof document === 'undefined') return;
  try {
    const maxAge = days * 24 * 60 * 60;
    const encoded = encodeURIComponent(value);
    document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch (e) {
    console.warn(`Failed to set cookie "${name}":`, e);
  }
}

/** Get cookie value by name */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

/** Remove cookie by name */
export function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  } catch {}
}

/**
 * Persist an item in both localStorage and long-lived cookie
 */
export function setPersistentItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
  setCookie(key, value, 365);
}

/**
 * Retrieve an item from localStorage with cookie fallback
 */
export function getPersistentItem(key: string): string | null {
  try {
    const local = localStorage.getItem(key);
    if (local !== null) return local;
  } catch {}
  return getCookie(key);
}

/**
 * Remove an item from both localStorage and cookie
 */
export function removePersistentItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
  removeCookie(key);
}
