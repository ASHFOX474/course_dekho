"use client";
import { useState, type FormEvent } from 'react';
import { useDatabaseData } from '@/lib/client/use-database-data';
import { getSupportThread, replySupport } from '@/lib/client/support-api';

export function SupportConversation({ id, token, admin = false, onChange }: { id: string; token?: string; admin?: boolean; onChange?: () => void }) {
  const thread = useDatabaseData(`support:${id}:${token ?? 'session'}`, signal => getSupportThread(id, token, signal), null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function send(input: { message?: string; status?: 'open' | 'resolved' }, form?: HTMLFormElement) {
    setBusy(true); setError(''); setNotice('');
    try { await replySupport(id, input, token); form?.reset(); thread.refresh(); onChange?.(); setNotice(input.message ? 'Reply sent.' : 'Status updated.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to send your reply.'); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send({ message: String(new FormData(event.currentTarget).get('message')) }, event.currentTarget); }
  if (thread.isLoading) return <p role="status">Loading conversation...</p>;
  if (thread.error || !thread.data) return <p role="alert" className="text-rose-700">{thread.error ?? 'Request not found.'}<button onClick={thread.refresh} className="ml-3 underline">Retry</button></p>;
  const { ticket, messages } = thread.data;
  return <section className="panel space-y-5 p-5" aria-label="Support conversation">
    <header><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold">{ticket.subject}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize">{ticket.status}</span></div><p className="mt-1 text-sm capitalize text-slate-500">{ticket.category} · {new Date(ticket.createdAt).toLocaleString()}</p></header>
    {admin && <div className="rounded-lg bg-slate-50 p-3 text-sm"><p>{ticket.contactName} · {ticket.contactEmail}</p>{ticket.category === 'recovery' && <><p className="mt-2">Account claimed: {ticket.accountIdentifier}</p><p className="mt-2 text-amber-800">Unverified public request. Confirm ownership independently before using User directory to issue a recovery link. Do not post reset links here: a tracking link is not proof of account ownership.</p></>}</div>}
    <ol className="space-y-3">{messages.map(message => <li key={message.id} className={`rounded-xl border p-4 ${message.sender === 'admin' ? 'border-indigo-100 bg-indigo-50' : 'border-slate-200'}`}><div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span className="font-semibold">{message.sender === 'admin' ? 'Admin' : admin ? 'Requester' : 'You'}</span><time>{new Date(message.createdAt).toLocaleString()}</time></div><p className="whitespace-pre-wrap break-words text-sm">{message.body}</p></li>)}</ol>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    <form onSubmit={submit} className="space-y-3"><label className="block text-sm font-medium">Reply<textarea name="message" required maxLength={4000} rows={4} disabled={busy} className="mt-1 w-full rounded-lg border border-slate-300 p-3" placeholder="Write your message. Do not include passwords." /></label><button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Sending...' : 'Send reply'}</button></form>
    {!admin && ticket.status === 'resolved' && <p className="text-xs text-slate-500">Sending another reply reopens your request.</p>}
    {admin && <button disabled={busy} className="rounded-lg border px-4 py-2 text-sm" onClick={() => void send({ status: ticket.status === 'open' ? 'resolved' : 'open' })}>{ticket.status === 'open' ? 'Mark resolved' : 'Reopen request'}</button>}
  </section>;
}
