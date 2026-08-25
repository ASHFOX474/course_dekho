"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { courses, getSemesterById, getUniversityById } from "@/lib/data/academics";
import { initialProgress } from "@/lib/data/activity";
import { computeCourseProgress } from "@/lib/queries";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressBar } from "@/components/ui/ProgressBar";

const ALL = "All";

export default function CoursesPage() {
  const { user } = useAuth();
  const [universityFilter, setUniversityFilter] = useState(ALL);
  const [semesterFilter, setSemesterFilter] = useState(ALL);
  const [search, setSearch] = useState("");

  const myProgress = user ? initialProgress.filter((p) => p.userId === user.id) : [];

  const universityNames = useMemo(
    () => [ALL, ...Array.from(new Set(courses.map((c) => getUniversityById(c.universityId)?.shortName ?? "")))],
    []
  );
  const semesterNames = useMemo(
    () => [ALL, ...Array.from(new Set(courses.map((c) => getSemesterById(c.semesterId)?.name ?? "")))],
    []
  );

  const filteredCourses = courses.filter((course) => {
    const universityName = getUniversityById(course.universityId)?.shortName ?? "";
    const semesterName = getSemesterById(course.semesterId)?.name ?? "";

    if (universityFilter !== ALL && universityName !== universityFilter) return false;
    if (semesterFilter !== ALL && semesterName !== semesterFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!course.code.toLowerCase().includes(q) && !course.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <AppShell title="Courses">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">All Courses</h2>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={universityFilter}
              onChange={(e) => setUniversityFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-violet-400 focus:outline-none"
            >
              {universityNames.map((name) => (
                <option key={name} value={name}>
                  {name === ALL ? "All Universities" : name}
                </option>
              ))}
            </select>

            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-violet-400 focus:outline-none"
            >
              {semesterNames.map((name) => (
                <option key={name} value={name}>
                  {name === ALL ? "All Semesters" : name}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses..."
                className="rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-violet-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => {
            const university = getUniversityById(course.universityId);
            const semester = getSemesterById(course.semesterId);
            const isEnrolled = myProgress.some((p) => p.courseId === course.id);
            const percent = isEnrolled ? computeCourseProgress(myProgress, course.id) : null;

            return (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{course.code}</p>
                    <p className="text-sm text-slate-600">{course.name}</p>
                  </div>
                </div>
                <p className="mb-3 text-xs text-slate-400">
                  {university?.shortName} &middot; {semester?.name}
                </p>
                {percent !== null ? (
                  <>
                    <ProgressBar percent={percent} />
                    <p className="mt-1 text-right text-xs font-medium text-slate-500">{percent}%</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">Not started yet</p>
                )}
              </Link>
            );
          })}

          {filteredCourses.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-slate-400">No courses match your filters.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
