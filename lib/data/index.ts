/**
 * lib/data/index.ts
 * ------------------------------------------------------------------
 * Re-exports everything in lib/data/ so the rest of the app can do:
 *   import { courses, users, resources } from "@/lib/data";
 * instead of importing from each individual file.
 * ------------------------------------------------------------------
 */
export * from "./users";
export * from "./academics";
export * from "./resources";
export * from "./submissions";
export * from "./bookmarks";
export * from "./activity";
