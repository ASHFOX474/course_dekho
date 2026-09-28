"use client";

import { useEffect } from "react";
import { getDisplayPreference } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";

export function WorkspacePreferences({ userId }: { userId: string }) {
  const preference = useDatabaseData(
    `display-preference:${userId}`,
    getDisplayPreference,
    { theme: "light" as const }
  );

  useEffect(() => {
    if (preference.isLoading || preference.error) return;
    document.documentElement.dataset.theme = preference.data.theme;
  }, [preference.data.theme, preference.error, preference.isLoading]);

  return null;
}
