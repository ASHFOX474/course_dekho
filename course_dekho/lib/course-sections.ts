export const courseSections = [
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'books', label: 'Books' },
  { id: 'slides', label: 'Slides' },
  { id: 'notes', label: 'Notes' },
  { id: 'resources', label: 'Topic resources' },
] as const;

export type CourseSectionId = (typeof courseSections)[number]['id'];
export interface CourseNavigation {
  activeId: CourseSectionId;
  onSelect: (id: CourseSectionId) => void;
}
