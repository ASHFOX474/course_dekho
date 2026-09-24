/**
 * lib/types.ts
 * ------------------------------------------------------------------
 * Central TypeScript type definitions for CourseDekho.
 *
 * These types are the frontend's mirror of the database ERD:
 *   User -> Learner / Contributor / Admin
 *   University -> Semester -> Course -> Topic -> Resource
 *   Submission (contributor upload -> admin approval workflow)
 *   Bookmark / TopicProgress / AccessHistoryEntry (user activity)
 *
 * Display-facing types retained for shared UI components. Persistent API
 * contracts live in lib/server/api/dtos.ts and PostgreSQL is the data source.
 * ------------------------------------------------------------------
 */

/** The three roles described in the project spec. */
export type UserRole = "learner" | "contributor" | "admin";

/**
 * A logged-in user. Combines the common "User" table fields with the
 * role-specific fields (department/year for learners, designation for
 * contributors) that would live in separate Learner/Contributor/Admin tables
 * in the real database (one-to-one with User via user_id).
 */
export interface AppUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  avatarInitials: string;

  // Learner-only fields
  universityId?: string;
  department?: string;
  yearOfStudy?: string;

  // Contributor-only fields
  designation?: string;
}

export interface University {
  id: string;
  name: string;
  shortName: string;
}

export interface Semester {
  id: string;
  universityId: string;
  name: string; // e.g. "Level 2, Term 1"
  sortOrder: number;
}

export interface Course {
  id: string;
  code: string; // e.g. "CSE-211"
  name: string; // e.g. "Data Structures & Algorithms"
  universityId: string;
  semesterId: string;
  description: string;
}

export interface Topic {
  id: string;
  courseId: string;
  name: string;
  sequenceOrder: number; // drives the ordered roadmap
  description: string;
  subtopics: string[]; // simple ordered list shown on the roadmap detail panel
}

/** Display resource types, including the combined course Notes category. */
export type ResourceType =
  | "Notes"
  | "Study Material"
  | "Practice Material"
  | "Book"
  | "Tutorial"
  | "Slide"
  | "Question"
  | "Practice";

/** A single piece of approved, published content attached to a topic. */
export interface Resource {
  id: string;
  topicId: string;
  courseId: string;
  type: ResourceType;
  title: string;
  description: string;
  addedById: string; // uploader's user id (teacher or admin)
  addedByName: string;
  year?: number; // relevant for Questions / academic material
  topicsCovered: string[];
  fileSizeLabel?: string; // e.g. "2.4 MB" (display only, no real file in the demo)
  views: number;
  downloads: number;
  uploadedAt: string; // ISO date
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

/**
 * Represents the Contributor -> Admin approval workflow.
 * A submission is created when a contributor uploads or edits content.
 * It only becomes a published `Resource` once an Admin approves it.
 */
export interface Submission {
  id: string;
  contributorId: string;
  contributorName: string;
  resourceType: ResourceType;
  title: string;
  description: string;
  courseId: string;
  courseCode: string;
  topicId: string;
  topicName: string;
  status: SubmissionStatus;
  submittedAt: string; // ISO date
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

/** What kind of thing a bookmark points at. */
export type BookmarkTargetType = "course" | "topic" | "resource";

export interface Bookmark {
  id: string;
  userId: string;
  targetType: BookmarkTargetType;
  targetId: string; // id of the Course / Topic / Resource
  title: string;
  subtitle: string; // e.g. "CSE-211 > Graph"
  resourceType?: ResourceType; // only set when targetType === "resource"
  createdAt: string; // ISO date
}

/** Tracks how far a student (or teacher, as a learner) has progressed through a topic. */
export interface TopicProgress {
  userId: string;
  topicId: string;
  courseId: string;
  progressPercent: number; // 0-100
  completed: boolean;
  lastAccessedAt: string; // ISO date
}

/** A single "user opened this resource" event, used for "Recent Access" / "Continue Learning". */
export interface AccessHistoryEntry {
  id: string;
  userId: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: ResourceType;
  courseCode: string;
  topicName: string;
  accessedAt: string; // ISO date
}

/** Tracks whether a student has solved a particular Question-type resource. */
export interface SolvedQuestion {
  userId: string;
  questionResourceId: string;
  solvedAt: string; // ISO date
}
