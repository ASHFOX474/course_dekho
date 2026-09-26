'use client';

import { useState } from "react";
import { Check, UserX, X } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  approveUser,
  deactivateUser,
  listAllUsers,
  listPendingUsers,
  rejectUser,
  type DirectoryUserDto,
  type PendingUserDto,
} from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { formatDate } from "@/lib/utils";
import { RecoveryLinkForm } from '@/components/account/RecoveryLinkForm';

const roleLabel: Record<string, string> = {
  learner: "Learner",
  contributor: "Contributor",
  admin: "Admin",
};

type Tab = "pending" | "all";

export default function AdminUserApprovalsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [recovering, setRecovering] = useState<{ id: string; name: string } | null>(null);

  const {
    data: pending,
    setData: setPending,
    isLoading: pendingLoading,
    error: pendingError,
    refresh: refreshPending,
  } = useDatabaseData<PendingUserDto[]>(
    `admin-pending-users:${user?.id ?? "anonymous"}`,
    listPendingUsers,
    []
  );

  const {
    data: allUsers,
    setData: setAllUsers,
    isLoading: allUsersLoading,
    error: allUsersError,
    refresh: refreshAllUsers,
  } = useDatabaseData<DirectoryUserDto[]>(
    `admin-all-users:${user?.id ?? "anonymous"}`,
    listAllUsers,
    []
  );

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const activeCount = allUsers.filter((row) => row.isActive).length;

  function removePending(id: string) {
    setPending((current) => current.filter((row) => row.id !== id));
    refreshPending();
    refreshAllUsers();
  }

  async function approve(id: string) {
    setWorkingId(id);
    setMutationError(null);
    try {
      await approveUser(id);
      removePending(id);
    } catch (requestError) {
      setMutationError(requestError instanceof Error ? requestError.message : "Unable to approve.");
    } finally {
      setWorkingId(null);
    }
  }

  async function reject(id: string) {
    if (!reason.trim()) return;
    setWorkingId(id);
    setMutationError(null);
    try {
      await rejectUser(id, reason.trim());
      setRejectingId(null);
      setReason("");
      removePending(id);
    } catch (requestError) {
      setMutationError(requestError instanceof Error ? requestError.message : "Unable to reject.");
    } finally {
      setWorkingId(null);
    }
  }

  async function deactivate(id: string) {
    if (!window.confirm("Deactivate this account? The user will lose access, but their records will be preserved.")) return;
    setWorkingId(id);
    setMutationError(null);
    try {
      await deactivateUser(id);
      setAllUsers((current) => current.map((row) => (row.id === id ? { ...row, isActive: false } : row)));
      refreshAllUsers();
    } catch (requestError) {
      setMutationError(requestError instanceof Error ? requestError.message : "Unable to remove this user.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <AppShell title="User Approvals" allowedRoles={["admin"]}>
      <div className="space-y-4">
        <div>
          <p className="page-kicker mb-2">Access management</p><h2 className="page-title">User directory</h2>
          <p className="text-sm text-slate-500">
            New learner and contributor accounts wait here until an admin approves them. Separate
            from Material Approvals, which reviews submitted content, not accounts.
          </p>
        </div>

        <input aria-label="Search users" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, username or email..." className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm" />
        <div className="flex flex-wrap gap-2 border-b">
          <button
            onClick={() => setTab("pending")}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === "pending" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500"
            }`}
          >
            Pending Approval ({pending.length})
          </button>
          <button
            onClick={() => setTab("all")}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === "all" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500"
            }`}
          >
            All Users ({activeCount} active{allUsers.length !== activeCount ? `, ${allUsers.length} total` : ""})
          </button>
        </div>

        {(pendingError || allUsersError || mutationError) && (
          <p role="alert" className="text-sm text-rose-600">
            {mutationError ?? pendingError ?? allUsersError}
          </p>
        )}

        {recovering && <RecoveryLinkForm key={recovering.id} userId={recovering.id} name={recovering.name} onClose={() => setRecovering(null)} />}
        {tab === "pending" ? (
          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm" aria-busy={pendingLoading}>
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">University</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pending.filter(row => `${row.name} ${row.email} ${row.username}`.toLowerCase().includes(search.toLowerCase())).map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-slate-500">{row.username}</td>
                    <td className="px-4 py-3 text-slate-500">{row.email}</td>
                    <td className="px-4 py-3 text-slate-500">{roleLabel[row.role] ?? row.role}</td>
                    <td className="px-4 py-3 text-slate-500">{row.universityName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(row.registeredAt.slice(0, 10))}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={workingId === row.id}
                          onClick={() => void approve(row.id)}
                          title="Approve"
                          className="rounded-full bg-emerald-50 p-1.5 text-emerald-600 disabled:opacity-40"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          disabled={workingId === row.id}
                          onClick={() => setRejectingId(row.id)}
                          title="Reject"
                          className="rounded-full bg-rose-50 p-1.5 text-rose-600 disabled:opacity-40"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!pendingLoading && pending.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No accounts waiting for approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm" aria-busy={allUsersLoading}>
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allUsers.filter(row => `${row.name} ${row.email} ${row.username}`.toLowerCase().includes(search.toLowerCase())).map((row) => (
                  <tr key={row.id} className={row.isActive ? "" : "opacity-50"}>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-slate-500">{row.username}</td>
                    <td className="px-4 py-3 text-slate-500">{row.email}</td>
                    <td className="px-4 py-3 text-slate-500">{roleLabel[row.role] ?? row.role}</td>
                    <td className="px-4 py-3">
                      {!row.isActive ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Removed
                        </span>
                      ) : row.registrationStatus === "pending" ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Pending
                        </span>
                      ) : row.registrationStatus === "rejected" ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                          Rejected
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(row.createdAt.slice(0, 10))}</td>
                    <td className="px-4 py-3 text-right">
                      {row.isActive && row.registrationStatus === 'approved' && <button className="mr-2 rounded-lg border px-2 py-1 text-xs" onClick={() => setRecovering({ id: row.id, name: row.name })}>Recovery link</button>}
                      {row.isActive && row.id !== user?.id ? (
                        <button
                          disabled={workingId === row.id}
                          onClick={() => void deactivate(row.id)}
                          title="Remove from site"
                          className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 disabled:opacity-40"
                        >
                          <UserX size={13} /> Remove
                        </button>
                      ) : row.id === user?.id ? (
                        <span className="text-xs text-slate-400">You</span>
                      ) : (
                        <span className="text-xs text-slate-400">Removed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!allUsersLoading && allUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {rejectingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="font-semibold">Reject registration</h3>
              <p className="mb-3 text-sm text-slate-500">
                The reason is preserved in PostgreSQL and shown to the person if they try to log in.
              </p>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                rows={3}
                autoFocus
                className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setRejectingId(null);
                    setReason("");
                  }}
                  className="px-3 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void reject(rejectingId)}
                  disabled={!reason.trim() || workingId === rejectingId}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
