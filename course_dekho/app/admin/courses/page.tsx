"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { getTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { listUniversities, listSemesters, type UniversitySummaryDto, type SemesterSummaryDto } from "@/lib/client/catalog-api";

export default function AdminCoursesPage() {
  const { user } = useAuth();
  const theme = getTheme(user?.role ?? 'learner');
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
      .catch(() => undefined);
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
      .catch(() => undefined);
    return () => controller.abort();
  }, [selectedUni]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!courseCode.trim() || !courseName.trim() || !selectedUni || !selectedSem) return;
    setIsSubmitting(true);
    // TODO: Call API to create course
    setIsSubmitting(false);
    setShowForm(false);
    setCourseCode("");
    setCourseName("");
    setDescription("");
  }

  return (
    <AppShell title="Manage Courses" allowedRoles={["admin"]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Manage Courses</h2>
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

        <div className={cn("rounded-2xl border", theme.cardBorder, theme.cardBg, "p-6 shadow-sm")}>
          <p className="text-sm text-slate-500">Course management feature coming soon. Courses will appear here.</p>
        </div>

        {showForm && (
          <NewCourseModal
            onClose={() => setShowForm(false)}
            onSubmit={handleSubmit}
            universities={universities}
            semesters={semesters}
            selectedUni={selectedUni}
            setSelectedUni={setSelectedUni}
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
      <div className={cn("w-full max-w-md rounded-2xl", theme.cardBg, "p-5 shadow-xl")}>
        <div className="mb-4 flex justify-between">
          <h3 className="font-semibold">Create New Course</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
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
            disabled={isSubmitting || !courseCode.trim() || !courseName.trim()}
            className={cn(
              "w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40",
              theme.primaryBg,
              theme.primaryText,
              theme.primaryHover
            )}
          >
            {isSubmitting ? "Creating..." : "Create Course"}
          </button>
        </form>
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
