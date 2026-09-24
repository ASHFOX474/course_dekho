"use client";
import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';

interface Asset { fileUrl: string | null; fileName: string | null; mimeType: string | null; externalUrl: string | null }
export function Attachment({ id, kind, preview = false }: { id: string; kind: 'resources' | 'submissions'; preview?: boolean }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/${kind}/${encodeURIComponent(id)}/attachment?info=1`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || 'Unable to load attachment.'); return body.data as Asset; })
      .then(setAsset).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [id, kind]);
  if (error) return <p role="alert" className="text-xs text-rose-600">{error}</p>;
  if (!asset) return <span className="text-xs text-slate-400">Loading attachment...</span>;
  if (!asset.fileUrl && !asset.externalUrl) return <span className="text-xs text-slate-400">No attachment</span>;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3 text-sm text-violet-700">
      {asset.fileUrl && <><a href={asset.fileUrl} target="_blank" rel="noopener noreferrer" className="break-all underline">{asset.fileName || 'Open file'}</a><a href={`${asset.fileUrl}?download=1`} className="inline-flex items-center gap-1 font-semibold"><Download size={15} />Download</a></>}
      {asset.externalUrl && <a href={asset.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold"><ExternalLink size={15} />{new URL(asset.externalUrl).hostname === 'drive.google.com' ? 'Open in Google Drive' : 'Open resource link'}</a>}
    </div>
    {preview && asset.fileUrl && asset.mimeType === 'application/pdf' && <iframe title={asset.fileName || 'PDF preview'} src={asset.fileUrl} className="h-[600px] w-full rounded-lg border" />}
    {preview && asset.fileUrl && ['image/png','image/jpeg','image/gif','image/webp'].includes(asset.mimeType || '') &&
      // Uploaded images are served through the authenticated delivery route.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={asset.fileUrl} alt={asset.fileName || 'Attached image'} className="max-h-[600px] max-w-full rounded-lg object-contain" />}
  </div>;
}
