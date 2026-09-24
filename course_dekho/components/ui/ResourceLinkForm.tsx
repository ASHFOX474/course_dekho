"use client";

import { useRef, useState, type FormEvent } from 'react';
import { publishResourceLink } from '@/lib/client/workspace-api';
import { courseResourceTypeLabel as resourceTypeLabel } from '@/lib/client/catalog-api';
import type { ResourceType } from '@/lib/server/domain/models';
import { topicResourceTypes } from '@/lib/resource-placement';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

export function ResourceLinkForm({ courseId, topicId, topicName, resourceTypes = topicResourceTypes, defaultResourceType, onClose, onSaved }: {
  courseId: string; topicId: string; topicName: string; onClose: () => void; onSaved: () => void;
  resourceTypes?: readonly ResourceType[];
  defaultResourceType?: ResourceType;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const initialCategory = defaultResourceType && resourceTypes.includes(defaultResourceType)
    ? defaultResourceType : resourceTypes.includes('question') ? 'question' : resourceTypes[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    submitting.current = true; setBusy(true); setError('');
    try {
      await publishResourceLink({
        courseId, topicId,
        resourceType: String(form.get('resourceType')) as ResourceType,
        title: String(form.get('title')).trim(),
        description: String(form.get('description')).trim(),
        externalUrl: String(form.get('externalUrl')).trim(),
      });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to publish the link.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <section className="panel p-5" aria-label="Add resource link">
    <h3 className="text-lg font-semibold">Add resource link to {topicName}</h3>
    <p className="mt-2 text-sm text-slate-600">Upload your PDF to Google Drive, copy its sharing link, and paste it below. Give your learners permission to open the file. The PDF stays in your Drive.</p>
    <form onSubmit={submit} className="mt-4 space-y-4">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Category<select key={initialCategory} name="resourceType" className={inputClass} defaultValue={initialCategory}>{resourceTypes.map(type => <option value={type} key={type}>{resourceTypeLabel(type)}</option>)}</select></label>
        <label className="text-sm font-medium">Title<input autoFocus name="title" required maxLength={200} placeholder={`${topicName} — Resource title`} className={inputClass} /></label>
        <label className="text-sm font-medium sm:col-span-2">PDF or practice link<input type="url" name="externalUrl" required maxLength={2000} placeholder="https://drive.google.com/file/d/.../view" className={inputClass} /></label>
        <label className="text-sm font-medium sm:col-span-2">Description (optional)<textarea name="description" maxLength={5000} rows={2} placeholder="What does this resource cover?" className={inputClass} /></label>
      </fieldset>
      <p className="text-xs text-slate-500">Publishing makes the resource visible to learners immediately.</p>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-3"><button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Publishing...' : 'Publish link'}</button><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Cancel</button></div>
    </form>
  </section>;
}
