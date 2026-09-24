export const courseResourceTypes = ['study_material', 'practice_material', 'book', 'slide'] as const;
export const topicResourceTypes = ['tutorial', 'question', 'leetcode_problem'] as const;

export function isCourseResource(type: string): boolean {
  return courseResourceTypes.some(value => value === type);
}

export function matchesCourseSection(type: string, section: string): boolean {
  if (section === 'notes') return type === 'study_material' || type === 'practice_material';
  if (section === 'books') return type === 'book';
  if (section === 'slides') return type === 'slide';
  return section === 'resources' && !isCourseResource(type);
}

export interface ResourceFilters {
  topicId: string;
  type: string;
  search: string;
}

export function filterCourseResources<T extends { type: string; topicId: string; title: string; description: string }>(
  resources: T[], section: string, filters: ResourceFilters
): T[] {
  const query = filters.search.trim().toLowerCase();
  return resources.filter(resource => matchesCourseSection(resource.type, section)
    && (!filters.topicId || resource.topicId === filters.topicId)
    && (!filters.type || resource.type === filters.type)
    && (!query || `${resource.title} ${resource.description}`.toLowerCase().includes(query)));
}
