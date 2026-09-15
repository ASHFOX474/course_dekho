"use client";

import { FormEvent, useState } from "react";
import { Plus, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { getTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export default function TeacherCourseSuggestionsPage() {
  const { user } = useAuth();
  const theme = getTheme(user?.role ?? 'learner');
  const [showForm, setShowForm] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!courseName.trim() || !description.trim()) return;
    setIsSubmitting(true);
    // TODO: Call API to submit course suggestion
    setIsSubmitting(false);
    setShowForm(false);
    setCourseName("");
    setDescription("");
  }

  return (
    <AppShell title="Suggest Courses" allowedRoles={["contributor"]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Suggest Courses</h2>
            <p className="text-sm text-slate-500">Suggest new courses. Admins will review and approve your suggestions.</p>
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
            Suggest Course
          </button>
        </div>

        <div className={cn("rounded-2xl border", theme.cardBorder, theme.cardBg, "p-6 shadow-sm")}>
          <p className="text-sm text-slate-500">No course suggestions yet. Your suggestions will appear here.</p>
        </div>

        {showForm && (
          <SuggestCourseModal
            onClose={() => setShowForm(false)}
            onSubmit={handleSubmit}
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

function SuggestCourseModal({
  onClose,
  onSubmit,
  courseName,
  setCourseName,
  description,
  setDescription,
  isSubmitting,
  theme,
}: {
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
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
          <h3 className="font-semibold">Suggest New Course</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Course Name">
            <input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              required
              maxLength={200}
              placeholder="e.g., Machine Learning Fundamentals"
              className={cn("w-full rounded-lg border", theme.inputBorder, "px-3 py-2 text-sm")}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={1000}
              rows={4}
              placeholder="Describe the course content and why it should be added..."
              className={cn("w-full rounded-lg border", theme.inputBorder, "px-3 py-2 text-sm")}
            />
          </Field>
          <p className="text-xs text-slate-400">Your suggestion will be pending until an admin approves it.</p>
          <button
            disabled={isSubmitting || !courseName.trim() || !description.trim()}
            className={cn(
              "w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40",
              theme.primaryBg,
              theme.primaryText,
              theme.primaryHover
            )}
          >
            {isSubmitting ? "Submitting..." : "Submit Suggestion"}
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
