/**
 * lib/data/academics.ts
 * ------------------------------------------------------------------
 * Mock "academic structure" tables:
 *
 *   University (1) --- (N) Semester (1) --- (N) Course (1) --- (N) Topic
 *
 * In the real system, only an Admin can create/edit these rows.
 * ------------------------------------------------------------------
 */
import { Course, Semester, Topic, University } from "@/lib/types";

export const universities: University[] = [
  { id: "buet", name: "Bangladesh University of Engineering and Technology", shortName: "BUET" },
  { id: "du", name: "University of Dhaka", shortName: "DU" },
  { id: "nsu", name: "North South University", shortName: "NSU" },
  { id: "brac", name: "BRAC University", shortName: "BRACU" },
];

export const semesters: Semester[] = [
  { id: "sem-l2t1", universityId: "buet", name: "Level 2, Term 1", sortOrder: 3 },
  { id: "sem-l2t2", universityId: "buet", name: "Level 2, Term 2", sortOrder: 4 },
  { id: "sem-l3t1", universityId: "buet", name: "Level 3, Term 1", sortOrder: 5 },
  { id: "sem-l3t2", universityId: "buet", name: "Level 3, Term 2", sortOrder: 6 },
];

export const courses: Course[] = [
  {
    id: "cse-211",
    code: "CSE-211",
    name: "Data Structures & Algorithms",
    universityId: "buet",
    semesterId: "sem-l2t1",
    description:
      "Core data structures (arrays, lists, stacks, queues, trees, graphs) and the fundamental algorithm design paradigms (greedy, dynamic programming) built on top of them.",
  },
  {
    id: "cse-213",
    code: "CSE-213",
    name: "Discrete Mathematics",
    universityId: "buet",
    semesterId: "sem-l2t1",
    description:
      "Mathematical foundations for computer science: logic, set theory, combinatorics, graph theory and proof techniques.",
  },
  {
    id: "cse-216",
    code: "CSE-216",
    name: "Digital Logic Design",
    universityId: "buet",
    semesterId: "sem-l2t2",
    description: "Boolean algebra, combinational and sequential circuits, and digital system design.",
  },
  {
    id: "cse-222",
    code: "CSE-222",
    name: "Database Systems",
    universityId: "buet",
    semesterId: "sem-l3t1",
    description: "Relational model, SQL, normalization, transactions, indexing and query processing.",
  },
  {
    id: "cse-231",
    code: "CSE-231",
    name: "Computer Organization",
    universityId: "buet",
    semesterId: "sem-l3t1",
    description: "CPU architecture, memory hierarchy, instruction sets and pipelining.",
  },
  {
    id: "cse-233",
    code: "CSE-233",
    name: "Algorithms",
    universityId: "buet",
    semesterId: "sem-l3t2",
    description: "Advanced algorithm design and analysis: divide & conquer, NP-completeness, approximation algorithms.",
  },
];

/**
 * Topics for CSE-211 (Data Structures & Algorithms).
 * `sequenceOrder` is what drives the ordered roadmap on the course page —
 * the UI never hardcodes "1, 2, 3...", it just sorts by this column.
 */
export const topics: Topic[] = [
  {
    id: "topic-array",
    courseId: "cse-211",
    sequenceOrder: 1,
    name: "Array",
    description: "Static and dynamic arrays, common array manipulation techniques.",
    subtopics: ["1.1 Static vs Dynamic Arrays", "1.2 Two-Pointer Technique", "1.3 Sliding Window"],
  },
  {
    id: "topic-linked-list",
    courseId: "cse-211",
    sequenceOrder: 2,
    name: "Linked List",
    description: "Singly, doubly and circular linked lists and their operations.",
    subtopics: ["2.1 Singly Linked List", "2.2 Doubly Linked List", "2.3 Circular Linked List"],
  },
  {
    id: "topic-stack-queue",
    courseId: "cse-211",
    sequenceOrder: 3,
    name: "Stack & Queue",
    description: "LIFO/FIFO structures and their classic applications.",
    subtopics: ["3.1 Stack Operations", "3.2 Queue Operations", "3.3 Applications (Expression Evaluation, BFS)"],
  },
  {
    id: "topic-tree",
    courseId: "cse-211",
    sequenceOrder: 4,
    name: "Tree",
    description: "Binary trees, binary search trees and balanced trees.",
    subtopics: ["4.1 Binary Trees", "4.2 Binary Search Trees", "4.3 Tree Traversals", "4.4 Balanced Trees (AVL)"],
  },
  {
    id: "topic-graph",
    courseId: "cse-211",
    sequenceOrder: 5,
    name: "Graph",
    description: "Learn about graphs, BFS, DFS, shortest path algorithms and more.",
    subtopics: [
      "5.1 Introduction to Graph",
      "5.2 Graph Representations",
      "5.3 BFS & DFS",
      "5.4 Shortest Path (Dijkstra)",
      "5.5 Minimum Spanning Tree",
    ],
  },
  {
    id: "topic-greedy",
    courseId: "cse-211",
    sequenceOrder: 6,
    name: "Greedy",
    description: "Greedy choice property and classic greedy algorithms.",
    subtopics: ["6.1 Activity Selection", "6.2 Huffman Coding", "6.3 Fractional Knapsack"],
  },
  {
    id: "topic-dp",
    courseId: "cse-211",
    sequenceOrder: 7,
    name: "Dynamic Programming",
    description: "Breaking problems into overlapping subproblems with memoization and tabulation.",
    subtopics: ["7.1 Memoization vs Tabulation", "7.2 Knapsack Problems", "7.3 Longest Common Subsequence"],
  },
];

/** Small set of topics for CSE-222 so "Database Systems" isn't completely empty. */
export const cse222Topics: Topic[] = [
  {
    id: "topic-er-model",
    courseId: "cse-222",
    sequenceOrder: 1,
    name: "ER Model",
    description: "Entity-Relationship modelling and diagrams.",
    subtopics: ["1.1 Entities & Attributes", "1.2 Relationships", "1.3 ER Diagrams"],
  },
  {
    id: "topic-normalization",
    courseId: "cse-222",
    sequenceOrder: 2,
    name: "Normalization",
    description: "Functional dependencies and normal forms (1NF-BCNF).",
    subtopics: ["2.1 Functional Dependencies", "2.2 1NF, 2NF, 3NF", "2.3 BCNF"],
  },
  {
    id: "topic-sql",
    courseId: "cse-222",
    sequenceOrder: 3,
    name: "SQL",
    description: "Writing queries, joins, aggregation and subqueries.",
    subtopics: ["3.1 DDL & DML", "3.2 Joins", "3.3 Aggregation & Subqueries"],
  },
];

/** Small topic set for CSE-213 (Discrete Mathematics). */
export const cse213Topics: Topic[] = [
  {
    id: "topic-logic",
    courseId: "cse-213",
    sequenceOrder: 1,
    name: "Propositional Logic",
    description: "Logical connectives, truth tables and logical equivalence.",
    subtopics: ["1.1 Connectives", "1.2 Truth Tables", "1.3 Logical Equivalence"],
  },
  {
    id: "topic-set-theory",
    courseId: "cse-213",
    sequenceOrder: 2,
    name: "Set Theory",
    description: "Sets, relations and functions.",
    subtopics: ["2.1 Set Operations", "2.2 Relations", "2.3 Functions"],
  },
  {
    id: "topic-combinatorics",
    courseId: "cse-213",
    sequenceOrder: 3,
    name: "Combinatorics",
    description: "Counting principles, permutations and combinations.",
    subtopics: ["3.1 Counting Principles", "3.2 Permutations", "3.3 Combinations"],
  },
  {
    id: "topic-graph-theory-dm",
    courseId: "cse-213",
    sequenceOrder: 4,
    name: "Graph Theory",
    description: "Graph fundamentals from a discrete-math perspective.",
    subtopics: ["4.1 Graph Basics", "4.2 Trees", "4.3 Planarity"],
  },
];

/** Small topic set for CSE-216 (Digital Logic Design). */
export const cse216Topics: Topic[] = [
  {
    id: "topic-boolean-algebra",
    courseId: "cse-216",
    sequenceOrder: 1,
    name: "Boolean Algebra",
    description: "Boolean identities and simplification techniques.",
    subtopics: ["1.1 Boolean Identities", "1.2 K-Maps", "1.3 Simplification"],
  },
  {
    id: "topic-combinational-circuits",
    courseId: "cse-216",
    sequenceOrder: 2,
    name: "Combinational Circuits",
    description: "Adders, multiplexers, decoders and encoders.",
    subtopics: ["2.1 Adders", "2.2 Multiplexers", "2.3 Decoders/Encoders"],
  },
  {
    id: "topic-sequential-circuits",
    courseId: "cse-216",
    sequenceOrder: 3,
    name: "Sequential Circuits",
    description: "Flip-flops, latches and registers.",
    subtopics: ["3.1 Latches", "3.2 Flip-Flops", "3.3 Registers"],
  },
  {
    id: "topic-digital-systems",
    courseId: "cse-216",
    sequenceOrder: 4,
    name: "Digital Systems",
    description: "Putting it together: counters and simple digital systems.",
    subtopics: ["4.1 Counters", "4.2 Memory Basics", "4.3 System Design"],
  },
];

export const allTopics: Topic[] = [...topics, ...cse222Topics, ...cse213Topics, ...cse216Topics];

// ---- lookup helpers -------------------------------------------------

export function getUniversityById(id: string): University | undefined {
  return universities.find((u) => u.id === id);
}

export function getCourseById(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}

export function getTopicsByCourse(courseId: string): Topic[] {
  return allTopics.filter((t) => t.courseId === courseId).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

export function getTopicById(id: string): Topic | undefined {
  return allTopics.find((t) => t.id === id);
}

export function getSemesterById(id: string): Semester | undefined {
  return semesters.find((s) => s.id === id);
}
