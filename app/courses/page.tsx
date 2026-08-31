"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listCourses,
  listSemesters,
  listUniversities,
  type CourseSummaryDto,
  type SemesterSummaryDto,
  type UniversitySummaryDto,
} from "@/lib/client/catalog-api";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load the academic catalog.";
}

export default function CoursesPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [universities, setUniversities] = useState<UniversitySummaryDto[]>([]);
  const [semesters, setSemesters] = useState<SemesterSummaryDto[]>([]);
  const [semestersForUniversityId, setSemestersForUniversityId] = useState("");
  const [courses, setCourses] = useState<CourseSummaryDto[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [resolvedCourseRequest, setResolvedCourseRequest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const courseRequest = JSON.stringify([universityId, semesterId, debouncedSearch]);
  const isCatalogLoading = resolvedCourseRequest !== courseRequest;
  const visibleCourses = isCatalogLoading ? [] : courses;
  const visibleSemesters =
    semestersForUniversityId === universityId ? semesters : [];

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (isAuthLoading || !user) return;
    const controller = new AbortController();

    listUniversities(controller.signal)
      .then((response) => {
        setUniversities(response);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });

    return () => controller.abort();
  }, [isAuthLoading, user]);

  useEffect(() => {
    if (!universityId || isAuthLoading || !user) return;

    const controller = new AbortController();
    listSemesters(universityId, controller.signal)
      .then((response) => {
        setSemesters(response);
        setSemestersForUniversityId(universityId);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });

    return () => controller.abort();
  }, [universityId, isAuthLoading, user]);

  useEffect(() => {
    if (isAuthLoading || !user) return;
    const controller = new AbortController();

    listCourses(
      {
        universityId: universityId || undefined,
        semesterId: semesterId || undefined,
        query: debouncedSearch || undefined,
      },
      controller.signal
    )
      .then((response) => {
        setCourses(response);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvedCourseRequest(courseRequest);
      });

    return () => controller.abort();
  }, [courseRequest, debouncedSearch, isAuthLoading, semesterId, universityId, user]);

  return (
    <AppShell title="Courses">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">All Courses</h2>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={universityId}
              onChange={(event) => {
                setUniversityId(event.target.value);
                setSemesterId("");
              }}
              aria-label="Filter by university"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-violet-400 focus:outline-none"
            >
              <option value="">All Universities</option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.shortName}
                </option>
              ))}
            </select>

            <select
              value={semesterId}
              onChange={(event) => setSemesterId(event.target.value)}
              disabled={!universityId}
              aria-label="Filter by semester"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-violet-400 focus:outline-none"
            >
              <option value="">All Semesters</option>
              {visibleSemesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={100}
                placeholder="Search courses..."
                aria-label="Search courses"
                className="rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-violet-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {!isCatalogLoading && error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={isCatalogLoading}>
          {visibleCourses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300"
            >
              <p className="text-sm font-bold text-slate-900">{course.code}</p>
              <p className="text-sm text-slate-600">{course.name}</p>
              <p className="mt-3 text-xs text-slate-400">
                {course.university.shortName} &middot; {course.semester.name}
              </p>
              <p className="mt-3 line-clamp-2 text-xs text-slate-500">
                {course.description || "Open the database-ordered course roadmap."}
              </p>
            </Link>
          ))}

          {isCatalogLoading && (
            <p className="col-span-full py-10 text-center text-sm text-slate-400">
              Loading courses...
            </p>
          )}

          {!isCatalogLoading && !error && visibleCourses.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-slate-400">
              No courses match your filters.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
