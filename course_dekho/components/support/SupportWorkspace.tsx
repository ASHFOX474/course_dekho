"use client";
import { useCallback, useRef, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth/AuthContext';
import { useDatabaseData } from '@/lib/client/use-database-data';
import { createSupport, listSupport, replySupport, resolveAllSupport } from '@/lib/client/support-api';
import { focusSection } from '@/lib/client/focus-section';
import { notifyAdminAttentionChanged } from '@/lib/client/admin-attention';
import { SupportConversation } from './SupportConversation';

export function SupportWorkspace({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  const tickets = useDatabaseData(`support-list:${user?.id}`, listSupport, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const conversationRef = useRef<HTMLDivElement>(null);
  const focusConversation = useCallback(() => focusSection(conversationRef.current), []);
  const [resolving, setResolving] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try { const result = await createSupport({ category: form.get('category') as 'problem' | 'suggestion', subject: String(form.get('subject')), message: String(form.get('message')) }); setSelected(result.id); setComposing(false); tickets.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to send request.'); }
    finally { setBusy(false); }
  }
  function selectRequest(id: string) {
    setSelected(id);
    setComposing(false);
    requestAnimationFrame(() => focusSection(conversationRef.current));
  }
  function refreshTickets() {
    tickets.refresh();
    notifyAdminAttentionChanged();
  }
  async function resolve(id?: string) {
    setResolving(id ?? 'all'); setError(''); setNotice('');
    try {
      if (id) {
        await replySupport(id, { status: 'resolved' });
        setNotice('Request marked as resolved.');
      } else {
        const result = await resolveAllSupport();
        setNotice(`${result.resolvedCount} request${result.resolvedCount === 1 ? '' : 's'} marked as resolved.`);
      }
      tickets.setData(current => current.map(ticket => !id || ticket.id === id ? { ...ticket, status: 'resolved' } : ticket));
      refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resolve requests.');
    } finally { setResolving(null); }
  }
  const visible = tickets.data.filter(ticket => (filter === 'all' || ticket.status === filter || ticket.category === filter) && `${ticket.subject} ${ticket.contactName} ${ticket.contactEmail}`.toLowerCase().includes(search.toLowerCase()));
  const openCount = tickets.data.filter(ticket => ticket.status === 'open').length;
  return <AppShell title={admin ? 'Support inbox' : 'Help & suggestions'} allowedRoles={admin ? ['admin'] : ['learner', 'contributor']}><div className="space-y-5">
    <header className="flex flex-wrap justify-between gap-3"><div><h1 className="page-title">{admin ? 'Support inbox' : 'Talk to the admin'}</h1><p className="mt-2 text-sm text-slate-500">{admin ? 'Reply to recovery requests, problems, and suggestions.' : 'Report a problem, ask for help, or suggest an improvement. Replies appear here.'}</p></div>{admin && <button type="button" disabled={resolving !== null || tickets.isLoading} onClick={() => void resolve()} className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{resolving === 'all' ? 'Resolving...' : 'Mark all resolved'}</button>}{!admin && <button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => { setComposing(true); setSelected(null); setError(''); }}>New request</button>}</header>
    {!composing && error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {admin && openCount > 0 && <div role="status" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{openCount} open request{openCount === 1 ? '' : 's'} still need attention.</div>}
    {composing && <form onSubmit={submit} className="panel space-y-4 p-5"><h2 className="font-semibold">New request</h2>{error && <p role="alert" className="text-rose-600">{error}</p>}<fieldset disabled={busy} className="space-y-4"><label className="block text-sm">Type<select name="category" className="mt-1 w-full rounded-lg border p-2"><option value="problem">Problem / question</option><option value="suggestion">Suggestion</option></select></label><label className="block text-sm">Subject<input name="subject" required maxLength={200} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm">Message<textarea name="message" required maxLength={4000} rows={5} className="mt-1 w-full rounded-lg border p-3" placeholder="Tell us what happened or what you would like improved. Never include passwords." /></label><div className="flex gap-3"><button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{busy ? 'Sending...' : 'Send request'}</button><button type="button" onClick={() => setComposing(false)}>Cancel</button></div></fieldset></form>}
    <div className="flex flex-wrap gap-3"><label className="text-sm">Filter<select value={filter} onChange={event => setFilter(event.target.value)} className="ml-2 rounded-lg border p-2">{['all', 'open', 'resolved', 'recovery', 'problem', 'suggestion'].filter(value => admin || value !== 'recovery').map(value => <option key={value} value={value}>{value}</option>)}</select></label><input aria-label="Search requests" placeholder="Search requests" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 rounded-lg border px-3 py-2 text-sm" /></div>
    {tickets.error && <p role="alert" className="text-rose-600">{tickets.error}<button className="ml-3 underline" onClick={tickets.refresh}>Retry</button></p>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(240px,1fr)_2fr]">
      <section className="panel overflow-hidden" aria-label="Requests">
        <h2 className="border-b p-4 font-semibold">{admin ? 'Requests' : 'Your requests'} <span className="text-xs font-normal text-slate-500">(latest 200)</span></h2>
        {tickets.isLoading ? <p className="p-5">Loading requests...</p> : !visible.length ? <p className="p-5 text-sm text-slate-500">No requests found.</p> : <ul className="divide-y">{visible.map(ticket => <li key={ticket.id} className={`flex items-center gap-2 pr-3 ${selected === ticket.id ? 'bg-indigo-50' : 'hover:bg-slate-50'} ${admin && ticket.status === 'open' ? 'border-l-4 border-rose-400 bg-rose-50/60' : ''}`}>
          <button type="button" aria-pressed={selected === ticket.id} aria-controls="support-conversation" className="min-w-0 flex-1 break-words p-4 text-left" onClick={() => selectRequest(ticket.id)}>
            <span className="block text-sm font-semibold">{ticket.subject}</span>
            <span className="mt-1 block text-xs capitalize text-slate-500">{ticket.category} &middot; {ticket.status}{admin ? ` · ${ticket.contactName}` : ''}</span>
          </button>
          {admin && ticket.status === 'open' && <button type="button" disabled={resolving !== null} aria-label={`Mark ${ticket.subject} as resolved`} onClick={() => void resolve(ticket.id)} className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40">{resolving === ticket.id ? 'Resolving...' : 'Mark resolved'}</button>}
        </li>)}</ul>}
      </section>
      <div id="support-conversation" ref={conversationRef} tabIndex={-1} aria-label="Selected support request" className="min-w-0 scroll-mt-4">
        {selected ? <SupportConversation key={selected} id={selected} admin={admin} onChange={refreshTickets} onReady={focusConversation} /> : <p className="p-5 text-sm text-slate-500">Select a request to read and reply.</p>}
      </div>
    </div>
  </div></AppShell>;
}
