"use client";
import { useEffect } from 'react';
import { usePreferences } from '@/lib/client/preferences';
export function WorkspacePreferences({ userId }: { userId: string }) {
  const { preferences } = usePreferences(userId);
  useEffect(() => {
    document.documentElement.dataset.density = preferences.compact ? 'compact' : 'comfortable';
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
    return () => { delete document.documentElement.dataset.density; delete document.documentElement.dataset.reduceMotion; };
  }, [preferences.compact, preferences.reduceMotion]);
  return null;
}
