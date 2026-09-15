"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createCourse } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { listCourses } from "@/lib/client/catalog-api";
import { Plus, X, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { getTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { listUniversities, listSemesters, type UniversitySummaryDto, type SemesterSummaryDto } from "@/lib/client/catalog-api";

export default function AdminCoursesPage() {
  const { user } = useAuth();
  const theme = getTheme(user?.role ?? 'learner');
  const courses = useDatabaseData(`admin-courses:${user?.id}`, (signal) => listCourses({}, signal), []);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [universities, setUniversities] = useState<UniversitySummaryDto[]>([]);
  const [semesters, setSemesters] = useState<SemesterSummaryDto[]>([]);
  const [selectedUni, setSelectedUni] = useState("");
  const [selectedSem, setSelectedSem] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listUniversities(controller.signal)
      .then((data) => {
        setUniversities(data);
        setSelectedUni(data[0]?.id ?? "");
      })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load universities or semesters. Please refresh the page."); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedUni) return;
    const controller = new AbortController();
    listSemesters(selectedUni, controller.signal)
      .then((data) => {
        setSemesters(data);
        setSelectedSem(data[0]?.id ?? "");
      })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load universities or semesters. Please refresh the page."); });
    return () => controller.abort();
  }, [selectedUni]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!courseCode.trim() || !courseName.trim() || !selectedUni || !selectedSem) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createCourse({ universityId: selectedUni, semesterId: selectedSem, code: courseCode, name: courseName, description });
      courses.refresh(); setSuccess(`${courseCode.toUpperCase()} was created successfully.`);
      setShowForm(false); setCourseCode(""); setCourseName(""); setDescription("");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to create course."); }
    finally { setIsSubmitting(false); }
  }

  return (
    <AppShell title="Manage Courses" allowedRoles={["admin"]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="page-kicker mb-2">Academic structure</p><h2 className="page-title">Course management</h2>
            <p className="text-sm text-slate-500">Create and organize courses for universities and semesters.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold",
              theme.primaryBg,
              theme.primaryText,
              theme.primaryHover
            )}
          >
            <Plus size={15} />
            New Course
          </button>
        </div>

        {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
        {(error || courses.error) && !showForm && <p role="alert" className="text-sm text-rose-600">{error ?? courses.error}</p>}
        <section className="panel"><div className="panel-heading"><h3>{courses.data.length} active courses</h3><label className="flex items-center gap-2"><Search size={15} className="text-slate-400" /><input aria-label="Search managed courses" value={search} onChange={event => setSearch(event.target.value)} placeholder="Code or course name" className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-xs sm:w-60" /></label></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">University / semester</th><th className="px-5 py-3">Roadmap</th></tr></thead><tbody>{courses.data.filter(course => `${course.code} ${course.name}`.toLowerCase().includes(search.toLowerCase())).map(course => <tr key={course.id} className="border-t border-slate-100"><td className="px-5 py-4 font-mono text-xs">{course.code}</td><td className="px-5 py-4 font-medium">{course.name}</td><td className="px-5 py-4 text-xs text-slate-500">{course.university.shortName} / {course.semester.name}</td><td className="px-5 py-4"><Link href={`/courses/${course.id}`} className="text-xs font-semibold underline">Open course ?</Link></td></tr>)}</tbody></table>{courses.isLoading && <p className="p-8 text-center text-sm text-slate-400">Loading courses?</p>}{!courses.isLoading && !courses.data.filter(course => `${course.code} ${course.name}`.toLowerCase().includes(search.toLowerCase())).length && <p className="p-8 text-center text-sm text-slate-400">No courses match your search.</p>}</div></section>

        {showForm && (
          <NewCourseModal
            error={error}
            onClose={() => setShowForm(false)}
            onSubmit={handleSubmit}
            universities={universities}
            semesters={semesters}
            selectedUni={selectedUni}
            setSelectedUni={(id) => { setSelectedUni(id); setSelectedSem(""); setSemesters([]); }}
            selectedSem={selectedSem}
            setSelectedSem={setSelectedSem}
            courseCode={courseCode}
            setCourseCode={setCourseCode}
            courseName={courseName}
            setCourseName={setCourseName}
            description={description}
            setDescription={setDescription}
            isSubmitting={isSubmitting}
            theme={theme}
          />
        )}
      </div>
    </AppShell>
  );
}

function NewCourseModal({
  error,
  onClose,
  onSubmit,
  universities,
  semesters,
  selectedUni,
  setSelectedUni,
  selectedSem,
  setSelectedSem,
  courseCode,
  setCourseCode,
  courseName,
  setCourseName,
  description,
  setDescription,
  isSubmitting,
  theme,
}: {
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  universities: UniversitySummaryDto[];
  semesters: SemesterSummaryDto[];
  selectedUni: string;
  setSelectedUni: (id: string) => void;
  selectedSem: string;
  setSelectedSem: (id: string) => void;
  courseCode: string;
  setCourseCode: (code: string) => void;
  courseName: string;
  setCourseName: (name: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  isSubmitting: boolean;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={cn("max-h-[90vh] overflow-y-auto w-full max-w-md rounded-2xl", theme.cardBg, "p-5 shadow-xl")}>
        <div className="mb-4 flex justify-between">
          <h3 className="font-semibold">Create New Course</h3>
          <button disabled={isSubmitting} aria-label="Close course form" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit}><fieldset disabled={isSubmitting} className="space-y-3">
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          <Field label="University">
            <select
              value={selectedUni}
              onChange={(e) => setSelectedUni(e.target.value)}
              required
              className={cn("w-full rounded-lg border", theme.inputBorder, "px-3 py-2 text-sm")}
            >
              <option value="">Select university</option>
              {universities.map((uni) => (
                <option key={uni.id} value={uni.id}>
                  {uni.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Semester">
            <select
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              required
              className={cn("w-full rounded-lg border", theme.inputBorder, "px-3 py-2 text-sm")}
            >
              <option value="">Select semester</option>
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Course Code">
            <input
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              required
              maxLength={20}
              placeholder="e.g., CSE-211"
              className={cn("w-full rounded-lg border", theme.inputBorder, "px-3 py-2 text-sm")}
            />
          </Field>
          <Field label="Course Name">
            <input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              required
              maxLength={200}
              placeholder="e.g., Data Structures & Algorithms"
              className={cn("w-full rounded-lg border", theme.inputBorder, "px-3 py-2 text-sm")}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              className={cn("w-full rounded-lg border", theme.inputBorder, "px-3 py-2 text-sm")}
            />
          </Field>
          <button
            disabled={isSubmitting || !selectedUni || !selectedSem || !courseCode.trim() || !courseName.trim()}
            className={cn(
              "w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40",
              theme.primaryBg,
              theme.primaryText,
              theme.primaryHover
            )}
          >
            {isSubmitting ? "Creating..." : "Create Course"}
          </button>
        </fieldset></form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
