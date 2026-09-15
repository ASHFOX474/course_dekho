"use client";
import { useSyncExternalStore } from 'react';
const changed = 'coursedekho-preferences';
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(changed, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(changed, callback); };
}
export function usePreferences(userId: string) {
  const key = `coursedekho:preferences:${userId}`;
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) ?? '{}'; } catch { return '{}'; } }, () => '{}');
  let preferences = { compact: false, reduceMotion: false };
  try { const stored = JSON.parse(raw); preferences = { compact: stored.compact === true, reduceMotion: stored.reduceMotion === true }; } catch { /* Use defaults for invalid browser settings. */ }
  function update(next: typeof preferences) {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(changed));
  }
  return { preferences, update };
}
