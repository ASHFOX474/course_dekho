'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ResourceLinkForm } from '@/components/ui/ResourceLinkForm';
import { useAuth } from '@/lib/auth/AuthContext';
import { useDatabaseData } from '@/lib/client/use-database-data';
import { listAcademicRecords, mutateAcademicRecord } from '@/lib/client/workspace-api';
import { filterAcademicRecords } from '@/lib/academic-management';
import type { AcademicKind, AcademicMutation, AcademicRecord } from '@/lib/academic-management';

const labels: Record<AcademicKind, string> = { university: 'Universities', semester: 'Semesters', course: 'Courses', topic: 'Topics', subtopic: 'Subtopics' };
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
const buttonClass = 'rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';

export default function AdminCoursesPage() {
  const { user } = useAuth();
  const catalog = useDatabaseData(`academic-management:${user?.id}`, signal => listAcademicRecords(signal), []);
  const [kind, setKind] = useState<AcademicKind>('course');
  const [universityId, setUniversityId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<{ record?: AcademicRecord } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AcademicRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [resourceTopic, setResourceTopic] = useState<AcademicRecord | null>(null);
  const records = catalog.data;
  const universities = records.filter(row => row.kind === 'university');
  const semesters = filterAcademicRecords(records, 'semester', { universityId });
  const courses = filterAcademicRecords(records, 'course', { universityId, semesterId });
  const topics = filterAcademicRecords(records, 'topic', { universityId, semesterId, courseId });
  const parentId = kind === 'semester' ? universityId : kind === 'course' ? semesterId : kind === 'topic' ? courseId : kind === 'subtopic' ? topicId : null;
  const parent = records.find(row => row.id === parentId);
  const canCreate = kind === 'university' || !!(parent?.isActive && parent.parentActive);
  const siblings = filterAcademicRecords(records, kind, kind === 'university' ? {} : { universityId, ...(kind !== 'semester' ? { semesterId } : {}), ...(['topic', 'subtopic'].includes(kind) ? { courseId } : {}), ...(kind === 'subtopic' ? { topicId } : {}) });
  const visible = siblings.filter(row => (showArchived || row.isActive) && `${row.name} ${row.code} ${row.shortName}`.toLowerCase().includes(search.toLowerCase()));

  function resetFeedback() { setEditor(null); setArchiveTarget(null); setResourceTopic(null); setError(null); setSuccess(''); }

  async function save(input: AcademicMutation, message: string) {
    setBusy(true); setError(null); setSuccess('');
    try {
      await mutateAcademicRecord(input);
      setEditor(null); setArchiveTarget(null); setSuccess(message);
      catalog.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save changes.'); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = {
      name: String(form.get('name') ?? ''),
      ...(kind === 'university' ? { shortName: String(form.get('shortName') ?? '') } : {}),
      ...(kind === 'course' ? { code: String(form.get('code') ?? '') } : {}),
      ...(['course', 'topic'].includes(kind) ? { description: String(form.get('description') ?? '') } : {}),
    };
    const input: AcademicMutation = editor?.record
      ? { action: 'edit', kind, id: editor.record.id, ...fields }
      : { action: 'create', kind, ...(parentId ? { parentId } : {}), ...fields };
    void save(input, `${labels[kind]} updated successfully.`);
  }

  function selector(label: string, value: string, options: AcademicRecord[], onChange: (id: string) => void, disabled = false) {
    return <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">{label}
      <select className={inputClass} value={value} disabled={busy || disabled} onChange={event => { onChange(event.target.value); resetFeedback(); }}>
        <option value="">All {label === 'University' ? 'universities' : label === 'Semester' ? 'semesters' : label === 'Course' ? 'courses' : 'topics'}</option>
        {options.map(row => <option key={row.id} value={row.id}>{row.code ? `${row.code} - ` : ''}{row.name}{!row.isActive ? ' (archived)' : !row.parentActive ? ' (parent archived)' : ''}</option>)}
      </select>
    </label>;
  }

  return <AppShell title="Academic management" allowedRoles={['admin']}>
    <div className="space-y-5">
      <div><p className="page-kicker mb-2">Academic structure</p><h2 className="page-title">Manage the learning roadmap</h2><p className="mt-2 text-sm text-slate-500">Create a course with its name, course code, and semester. Add any number of topics and subtopics, now or later. Resources are optional.</p></div>
      <nav aria-label="Academic sections" className="flex flex-wrap gap-2">
        {(Object.keys(labels) as AcademicKind[]).map(tab => <button key={tab} disabled={busy} aria-current={kind === tab ? 'page' : undefined} className={`${buttonClass} ${kind === tab ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : ''}`} onClick={() => { setKind(tab); setSearch(''); resetFeedback(); }}>{labels[tab]}</button>)}
      </nav>
      {kind !== 'university' && <section className="panel flex flex-col gap-4 p-5 md:flex-row" aria-label="Parent selection">
        {selector('University', universityId, universities, id => { setUniversityId(id); setSemesterId(''); setCourseId(''); setTopicId(''); })}
        {(kind === 'course' || kind === 'topic' || kind === 'subtopic') && selector('Semester', semesterId, semesters, id => { setSemesterId(id); setCourseId(''); setTopicId(''); })}
        {(kind === 'topic' || kind === 'subtopic') && selector('Course', courseId, courses, id => { setCourseId(id); setTopicId(''); })}
        {kind === 'subtopic' && selector('Topic', topicId, topics, setTopicId)}
      </section>}
      {(error || catalog.error) && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error ?? catalog.error}{catalog.error && <button className="ml-3 underline" onClick={catalog.refresh}>Retry loading</button>}</div>}
      {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
      {resourceTopic?.parentId && <ResourceLinkForm key={resourceTopic.id} courseId={resourceTopic.parentId} topicId={resourceTopic.id} topicName={resourceTopic.name} onClose={() => setResourceTopic(null)} onSaved={() => { setResourceTopic(null); setSuccess('Resource published. Learners can open the link from this topic.'); }} />}
      {parent && (!parent.isActive || !parent.parentActive) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This parent structure is archived. Restore it in its management section before creating, editing, restoring, or reordering items here.</p>}
      {!canCreate && !catalog.isLoading && <p className="text-sm text-slate-500">To create a {kind}, select its active parent above. You can browse and edit existing items without filters.</p>}
      {editor && <section className="panel p-5" aria-label={`${editor.record ? 'Edit' : 'New'} ${kind}`}>
        <h3 className="mb-4 text-lg font-semibold">{editor.record ? 'Edit' : 'New'} {kind}</h3>
        <form key={`${kind}:${editor.record?.id ?? 'new'}`} onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Name<input autoFocus className={inputClass} name="name" required maxLength={200} defaultValue={editor.record?.name} /></label>
            {kind === 'university' && <label className="text-sm font-medium">Short name<input className={inputClass} name="shortName" required maxLength={50} defaultValue={editor.record?.shortName} placeholder="e.g. BUET" /></label>}
            {kind === 'course' && <label className="text-sm font-medium">Course code / number<input className={inputClass} name="code" required maxLength={20} defaultValue={editor.record?.code} placeholder="e.g. CSE-201" /></label>}
            {['course', 'topic'].includes(kind) && <label className="text-sm font-medium sm:col-span-2">Description (optional)<textarea className={inputClass} name="description" rows={3} maxLength={1000} defaultValue={editor.record?.description} /></label>}
          </fieldset>
          {!editor.record && ['semester', 'topic', 'subtopic'].includes(kind) && <p className="text-xs text-slate-500">New items are added at the end. Use the arrow buttons to change their order.</p>}
          {!editor.record && kind === 'course' && <p className="text-sm text-slate-500">You can save an empty course. Use Manage topics and Manage subtopics to build its roadmap, and add resources whenever you are ready.</p>}
          <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" type="submit">{busy ? 'Saving...' : 'Save'}</button><button disabled={busy} className={buttonClass} type="button" onClick={() => setEditor(null)}>Cancel</button></div>
        </form>
      </section>}
      {archiveTarget && <section role="alertdialog" aria-labelledby="archive-title" aria-describedby="archive-description" className="panel border border-amber-300 p-5">
        <h3 id="archive-title" className="font-semibold">Archive {archiveTarget.name}?</h3>
        <p id="archive-description" className="my-3 text-sm text-slate-600">This hides the item and everything beneath it from the learning catalog. Resources, bookmarks, and learning history are preserved. You can restore it later; separately archived children stay archived.</p>
        <div className="flex gap-2"><button disabled={busy} className={buttonClass} onClick={() => void save({ action: 'archive', kind, id: archiveTarget.id }, 'Item archived. Its data has been preserved.')}>{busy ? 'Archiving...' : 'Confirm archive'}</button><button disabled={busy} className={buttonClass} onClick={() => setArchiveTarget(null)}>Cancel</button></div>
      </section>}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <h3 className="font-semibold">{labels[kind]} <span className="text-slate-400">({visible.length})</span></h3>
          <button disabled={busy || !canCreate || catalog.isLoading || !!catalog.error} className={`${buttonClass} flex items-center gap-2`} onClick={() => { setEditor({}); setArchiveTarget(null); setError(null); setSuccess(''); }}><Plus size={15} />New {kind}</button>
          <div className="flex w-full flex-wrap items-center gap-4">
            <input aria-label={`Search ${labels[kind].toLowerCase()}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or code" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Show archived</label>
          </div>
        </div>
        {catalog.isLoading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading academic structure...</p> : !visible.length ? <p className="p-8 text-center text-sm text-slate-500">{search ? 'No matching items.' : `No ${labels[kind].toLowerCase()} here yet. Create an item or show archived items.`}</p> : <ul className="divide-y divide-slate-100">
          {visible.map(row => {
            const orderedActive = records.filter(item => item.kind === row.kind && item.parentId === row.parentId && item.isActive).sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));
            const position = orderedActive.findIndex(item => item.id === row.id);
            const blocked = busy || !!catalog.error || !!editor || !!archiveTarget;
            return <li key={row.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{row.sequenceOrder !== null ? `${row.sequenceOrder}. ` : ''}{row.code || row.shortName ? `${row.code || row.shortName} - ` : ''}{row.name}</span>{!row.isActive && <span className="rounded bg-slate-100 px-2 py-1 text-xs">Archived</span>}{row.isActive && !row.parentActive && <span className="rounded bg-amber-50 px-2 py-1 text-xs">Parent archived</span>}</div>{row.parentId && <p className="mt-1 text-xs text-slate-500">{(() => { const names: string[] = []; let item = records.find(record => record.id === row.parentId); while (item) { names.unshift(item.code || item.shortName || item.name); item = records.find(record => record.id === item?.parentId); } return names.join(' / '); })()}</p>}{row.description && <p className="mt-1 max-w-xl whitespace-pre-wrap break-words text-sm text-slate-500">{row.description}</p>}</div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {row.kind === 'topic' && row.isActive && row.parentActive && <><button disabled={blocked} className={buttonClass} onClick={() => { resetFeedback(); setResourceTopic(row); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Add resource link</button><Link className={buttonClass} href={`/courses/${row.parentId}/topics/${row.id}`}>View resources</Link></>}
                {row.kind !== 'subtopic' && <button disabled={busy} className={buttonClass} onClick={() => {
                  resetFeedback(); setSearch('');
                  const ancestry = new Map<AcademicKind, string>();
                  let current: AcademicRecord | undefined = row;
                  while (current) { ancestry.set(current.kind, current.id); current = records.find(item => item.id === current?.parentId); }
                  setUniversityId(ancestry.get('university') ?? '');
                  setSemesterId(ancestry.get('semester') ?? '');
                  setCourseId(ancestry.get('course') ?? '');
                  setTopicId(ancestry.get('topic') ?? '');
                  setKind(row.kind === 'university' ? 'semester' : row.kind === 'semester' ? 'course' : row.kind === 'course' ? 'topic' : 'subtopic');
                }}>Manage {row.kind === 'university' ? 'semesters' : row.kind === 'semester' ? 'courses' : row.kind === 'course' ? 'topics' : 'subtopics'}</button>}
                {row.kind === 'course' && row.isActive && row.parentActive && <Link className={buttonClass} href={`/courses/${row.id}`}>View course</Link>}
                {(kind === 'topic' || kind === 'semester' || kind === 'subtopic') && row.isActive && <>
                  <button disabled={blocked || !row.parentActive || position <= 0} className={buttonClass} aria-label={`Move ${row.name} up`} onClick={() => void save({ action: 'move', kind, id: row.id, direction: 'up' }, 'Order updated.')}><ArrowUp size={15} /></button>
                  <button disabled={blocked || !row.parentActive || position === orderedActive.length - 1} className={buttonClass} aria-label={`Move ${row.name} down`} onClick={() => void save({ action: 'move', kind, id: row.id, direction: 'down' }, 'Order updated.')}><ArrowDown size={15} /></button>
                </>}
                <button disabled={blocked || !row.parentActive} className={buttonClass} onClick={() => { setEditor({ record: row }); setError(null); setSuccess(''); }}>Edit</button>
                <button disabled={blocked || (!row.isActive && !row.parentActive)} className={buttonClass} onClick={() => { if (row.isActive) { setArchiveTarget(row); setError(null); setSuccess(''); } else void save({ action: 'restore', kind, id: row.id }, 'Item restored.'); }}>{row.isActive ? 'Archive' : 'Restore'}</button>
              </div>
            </li>;
          })}
        </ul>}
      </section>
    </div>
  </AppShell>;
}
