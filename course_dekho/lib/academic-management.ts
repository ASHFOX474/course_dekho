export type AcademicKind = 'university' | 'semester' | 'course' | 'topic';

export interface AcademicRecord {
  id: string;
  kind: AcademicKind;
  parentId: string | null;
  name: string;
  description: string;
  code: string;
  shortName: string;
  sequenceOrder: number | null;
  isActive: boolean;
  parentActive: boolean;
}

export type AcademicMutation =
  | { action: 'create'; kind: AcademicKind; parentId?: string; name: string; description?: string; code?: string; shortName?: string }
  | { action: 'edit'; kind: AcademicKind; id: string; name: string; description?: string; code?: string; shortName?: string }
  | { action: 'archive'; kind: AcademicKind; id: string }
  | { action: 'restore'; kind: AcademicKind; id: string }
  | { action: 'move'; kind: 'semester' | 'topic'; id: string; direction: 'up' | 'down' };

export function filterAcademicRecords(records: AcademicRecord[], kind: AcademicKind, filters: { universityId?: string; semesterId?: string; courseId?: string } = {}) {
  const byId = new Map(records.map(row => [row.id, row]));
  return records.filter(row => {
    if (row.kind !== kind) return false;
    const ancestry = new Map<AcademicKind, string>();
    let current: AcademicRecord | undefined = row;
    while (current && !ancestry.has(current.kind)) {
      ancestry.set(current.kind, current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return (!filters.universityId || ancestry.get('university') === filters.universityId)
      && (!filters.semesterId || ancestry.get('semester') === filters.semesterId)
      && (!filters.courseId || ancestry.get('course') === filters.courseId);
  });
}
