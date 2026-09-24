"use client";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { listCourses, listCourseTopics, courseResourceTypeLabel, type ApprovedResourceDto, type CourseSummaryDto, type TopicSummaryDto } from '@/lib/client/catalog-api';
import { editResource } from '@/lib/client/workspace-api';
import type { ResourceEdit } from '@/lib/resource-edit';
import { isCourseResource } from '@/lib/resource-placement';

const categories: ResourceEdit['resourceType'][] = ['study_material', 'book', 'slide', 'tutorial', 'question', 'leetcode_problem'];
const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

export function EditResourceButton({ resource, onSaved }: { resource: ApprovedResourceDto; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700">Edit</button>
    {open && <ResourceEditor resource={resource} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved(); }} />}
  </>;
}

function ResourceEditor({ resource, onClose, onSaved }: { resource: ApprovedResourceDto; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [title, setTitle] = useState(resource.title);
  const [courseId, setCourseId] = useState(resource.courseId);
  const [topicId, setTopicId] = useState(resource.topicId);
  const [resourceType, setResourceType] = useState<ResourceEdit['resourceType']>(resource.type);
  const [courses, setCourses] = useState<CourseSummaryDto[]>([]);
  const [topics, setTopics] = useState<TopicSummaryDto[]>([]);
  const [loadedCourseId, setLoadedCourseId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    listCourses({}, controller.signal).then(setCourses).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    listCourseTopics(courseId, controller.signal).then(rows => { setTopics(rows); setLoadedCourseId(courseId); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [courseId]);
  const destination = isCourseResource(resourceType)
    ? topics.find(topic => topic.id === topicId)?.id ?? topics[0]?.id ?? ''
    : topicId;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await editResource(resource.id, { title: title.trim(), courseId, topicId: destination, resourceType });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save resource.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby={`edit-${resource.id}`} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-950/40"
    onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    <h2 id={`edit-${resource.id}`} className="text-lg font-bold">Edit resource</h2>
    <form onSubmit={submit} className="mt-4 space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-medium">Name<input autoFocus required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} className={inputClass} /></label>
        <label className="block text-sm font-medium">Move to course<select required value={courseId} onChange={event => { setCourseId(event.target.value); setTopicId(''); setError(''); }} className={inputClass}>
          {!courses.length && <option value={resource.courseId}>Loading courses...</option>}
          {courses.map(course => <option key={course.id} value={course.id}>{course.code} — {course.name}</option>)}
        </select></label>
        <label className="block text-sm font-medium">Category<select value={resourceType} onChange={event => setResourceType(event.target.value as ResourceEdit['resourceType'])} className={inputClass}>
          {resourceType === 'practice_material' && <option value="practice_material">Notes</option>}
          {categories.filter(type => resourceType !== 'practice_material' || type !== 'study_material').map(type => <option key={type} value={type}>{courseResourceTypeLabel(type)}</option>)}
        </select></label>
        {!isCourseResource(resourceType) && <label className="block text-sm font-medium">Move to topic<select required value={topicId} onChange={event => setTopicId(event.target.value)} className={inputClass}>
          <option value="">Select topic</option>
          {loadedCourseId === courseId && topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </select></label>}
      </fieldset>
      {loadedCourseId === courseId && !topics.length && <p className="text-sm text-amber-700">This course needs an active topic before resources can be moved here.</p>}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-3"><button disabled={busy || !courses.length || loadedCourseId !== courseId || !destination} className="action-primary disabled:opacity-40">{busy ? 'Saving...' : 'Save changes'}</button>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div>
    </form>
  </dialog>;
}
