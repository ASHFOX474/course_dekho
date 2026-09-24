"use client";

import { useState } from 'react';
import { removeResource } from '@/lib/client/workspace-api';

export function RemoveResourceButton({ resourceId, title, onRemoved }: { resourceId: string; title: string; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!window.confirm(`Remove "${title}" from the learning catalog? Its history will be preserved.`)) return;
    setBusy(true); setError('');
    try { await removeResource(resourceId); onRemoved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to remove resource.'); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40" aria-label={`Remove ${title}`}>{busy ? 'Removing...' : 'Remove resource'}</button>{error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}</div>;
}
