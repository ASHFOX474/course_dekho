export interface ResourceEdit {
  title: string;
  courseId: string;
  topicId: string;
  resourceType: 'study_material' | 'practice_material' | 'book' | 'tutorial' | 'slide' | 'question' | 'leetcode_problem';
}
