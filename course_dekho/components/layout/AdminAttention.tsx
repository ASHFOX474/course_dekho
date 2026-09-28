"use client";

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAdminStats } from '@/lib/client/workspace-api';
import { useDatabaseData } from '@/lib/client/use-database-data';
import { ADMIN_ATTENTION_CHANGED } from '@/lib/client/admin-attention';
import type { AdminStatsDto } from '@/lib/server/api/dtos';

const emptyStats: AdminStatsDto = {
  userCount: 0, courseCount: 0, publishedResourceCount: 0, submissionCount: 0,
  pendingSubmissionCount: 0, pendingUserCount: 0, pendingEnrollmentCount: 0, openSupportCount: 0,
};
const AdminAttentionContext = createContext<ReturnType<typeof useDatabaseData<AdminStatsDto>> | null>(null);

export function AdminAttentionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const stats = useDatabaseData(`admin-stats:${user?.id}`, getAdminStats, emptyStats);
  const { refresh } = stats;
  useEffect(() => {
    window.addEventListener(ADMIN_ATTENTION_CHANGED, refresh);
    return () => window.removeEventListener(ADMIN_ATTENTION_CHANGED, refresh);
  }, [refresh]);
  return <AdminAttentionContext.Provider value={stats}>{children}</AdminAttentionContext.Provider>;
}

export function useAdminAttention() {
  return useContext(AdminAttentionContext);
}
