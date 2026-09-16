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
