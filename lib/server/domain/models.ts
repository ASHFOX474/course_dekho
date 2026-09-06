export const userRoles = ["student", "teacher", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const resourceTypes = [
  "study_material",
  "practice_material",
  "book",
  "tutorial",
  "slide",
  "question",
  "leetcode_problem",
] as const;
export type ResourceType = (typeof resourceTypes)[number];

export const submissionStatuses = ["pending", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export const enrollmentStatuses = ["active", "completed", "dropped"] as const;
export type EnrollmentStatus = (typeof enrollmentStatuses)[number];

export type PublicId = string;

export interface AuthenticatedUser {
  id: PublicId;
  name: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface Contributor {
  id: PublicId;
  name: string;
}

export interface UniversitySummary {
  id: PublicId;
  name: string;
  shortName: string;
}

export interface SemesterSummary {
  id: PublicId;
  universityId: PublicId;
  name: string;
  sortOrder: number;
}

export interface Course {
  id: PublicId;
  code: string;
  name: string;
  description: string;
  university: UniversitySummary;
  semester: SemesterSummary;
}

export interface CourseFilters {
  universityId?: PublicId;
  semesterId?: PublicId;
  query?: string;
}

export interface Subtopic {
  id: PublicId;
  slug: string;
  title: string;
  sequenceOrder: number;
}

export interface Topic {
  id: PublicId;
  courseId: PublicId;
  slug: string;
  name: string;
  description: string;
  sequenceOrder: number;
  subtopics: Subtopic[];
}

export type ApprovedResourceDetails =
  | {
      type: "study_material" | "practice_material";
      materialType: string | null;
      fileUrl: string | null;
      fileSizeBytes: number | null;
    }
  | {
      type: "book";
      bookTitle: string;
      author: string | null;
      publisher: string | null;
      fileUrl: string | null;
    }
  | {
      type: "tutorial";
      tutorialTitle: string;
      tutorialContent: string | null;
      fileUrl: string | null;
    }
  | {
      type: "slide";
      slideTitle: string;
      slideContent: string | null;
      fileUrl: string | null;
    }
  | {
      type: "question";
      questionText: string;
      difficulty: string | null;
      points: number | null;
    }
  | {
      type: "leetcode_problem";
      problemTitle: string;
      problemUrl: string | null;
      difficulty: string | null;
    };

export interface ApprovedResource {
  id: PublicId;
  topicId: PublicId;
  courseId: PublicId;
  type: ResourceType;
  title: string;
  description: string;
  addedBy: Contributor;
  year: number | null;
  topicsCovered: string[];
  fileSizeBytes: number | null;
  details?: ApprovedResourceDetails;
  views: number;
  downloads: number;
  uploadedAt: Date;
}

export interface Submission {
  id: PublicId;
  teacher: Contributor;
  resourceType: ResourceType;
  title: string;
  description: string;
  courseId: PublicId;
  courseCode: string;
  topicId: PublicId;
  topicName: string;
  status: SubmissionStatus;
  submittedAt: Date;
  reviewedBy: Contributor | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
}

export interface Enrollment {
  id: PublicId;
  userId: PublicId;
  courseId: PublicId;
  status: EnrollmentStatus;
  enrolledAt: Date;
}

export type BookmarkTargetType = "course" | "topic" | "resource";

export interface UserProfile {
  user: AuthenticatedUser;
  university: UniversitySummary | null;
  department: string | null;
  yearOfStudy: number | null;
  designation: string | null;
}

export interface LearningCourse {
  enrollmentId: PublicId;
  courseId: PublicId;
  code: string;
  name: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  progressPercent: number;
}

export interface TopicProgressView {
  id: PublicId;
  topicId: PublicId;
  topicName: string;
  courseId: PublicId;
  courseCode: string;
  courseName: string;
  progressPercent: number;
  completed: boolean;
  lastAccessedAt: Date;
}

export interface LearningOverview {
  courses: LearningCourse[];
  topics: TopicProgressView[];
}

export interface BookmarkView {
  id: PublicId;
  targetType: BookmarkTargetType;
  targetId: PublicId;
  title: string;
  subtitle: string;
  resourceType: ResourceType | null;
  courseId: PublicId | null;
  createdAt: Date;
}

export interface AccessHistoryView {
  id: PublicId;
  resourceId: PublicId;
  resourceTitle: string;
  resourceType: ResourceType;
  courseId: PublicId;
  courseCode: string;
  topicId: PublicId;
  topicName: string;
  accessedAt: Date;
}

export interface SolvedQuestionView {
  id: PublicId;
  resourceId: PublicId;
  title: string;
  courseId: PublicId;
  courseCode: string;
  topicId: PublicId;
  topicName: string;
  solvedAt: Date;
}

export interface AdminStats {
  userCount: number;
  courseCount: number;
  publishedResourceCount: number;
  submissionCount: number;
}
