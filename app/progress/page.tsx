"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Layers } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuth } from "@/lib/auth/AuthContext";
import { getLearning, updateProgress } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { cn } from "@/lib/utils";

type Tab = "courses" | "topics";

export default function ProgressPage() {
  const { user } = useAuth();
  const { data: learning, setData: setLearning, isLoading, error, refresh } = useDatabaseData(
    `learning:${user?.id ?? "anonymous"}`,
    getLearning,
    { courses: [], topics: [] }
  );
  const [tab, setTab] = useState<Tab>("courses");
  const [savingTopicId, setSavingTopicId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const completed = learning.topics.filter((topic) => topic.completed).length;
  const inProgress = learning.topics.filter((topic) => !topic.completed && topic.progressPercent > 0).length;
  const overall = learning.topics.length === 0 ? 0 : Math.round(learning.topics.reduce((sum, topic) => sum + topic.progressPercent, 0) / learning.topics.length);

  async function saveProgress(topicId: string, progressPercent: number) {
    setSavingTopicId(topicId);
    setMutationError(null);
    try {
      setLearning(await updateProgress(topicId, progressPercent));
      refresh();
    } catch (requestError) {
      setMutationError(requestError instanceof Error ? requestError.message : "Unable to update progress.");
    } finally { setSavingTopicId(null); }
  }

  return <AppShell title="My Progress" allowedRoles={["student", "teacher"]}><div className="space-y-5">
    <div><h2 className="text-lg font-bold text-slate-900">My Progress</h2><p className="text-sm text-slate-500">Enrollment and topic progress stored in PostgreSQL.</p></div>
    {(error || mutationError) && <p role="alert" className="text-sm text-rose-600">{mutationError ?? error}</p>}
    <div className="flex gap-1 border-b border-slate-200">{(["courses", "topics"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={cn("border-b-2 px-3 pb-2.5 text-sm font-medium capitalize", tab === item ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500")}>By {item}</button>)}</div>
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3" aria-busy={isLoading}>
        {tab === "courses" && learning.courses.map((course) => <Link key={course.enrollmentId} href={`/courses/${course.courseId}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-violet-300"><div className="mb-2 flex justify-between"><div><p className="text-sm font-semibold text-slate-900">{course.code}</p><p className="text-xs text-slate-500">{course.name} · {course.status}</p></div><span className="text-sm font-bold text-violet-600">{course.progressPercent}%</span></div><ProgressBar percent={course.progressPercent} /></Link>)}
        {tab === "topics" && learning.topics.map((topic) => <div key={topic.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><Link href={`/courses/${topic.courseId}/topics/${topic.topicId}`}><p className="text-sm font-semibold text-slate-900 hover:text-violet-700">{topic.topicName}</p><p className="text-xs text-slate-500">{topic.courseCode} · {topic.courseName}</p></Link>
            <select aria-label={`Progress for ${topic.topicName}`} value={topic.progressPercent} disabled={savingTopicId === topic.topicId} onChange={(event) => void saveProgress(topic.topicId, Number(event.target.value))} className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-violet-700">{Array.from(new Set([0, 25, 50, 75, 100, topic.progressPercent])).sort((a, b) => a - b).map((value) => <option key={value} value={value}>{value}%</option>)}</select>
          </div><ProgressBar percent={topic.progressPercent} />
        </div>)}
        {!isLoading && (tab === "courses" ? learning.courses : learning.topics).length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">No database records yet.</p>}
      </div>
      <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col items-center"><CircularProgress percent={overall} size={120} strokeWidth={10} sublabel="Overall" /></div><div className="space-y-3 border-t border-slate-100 pt-4 text-sm"><SummaryRow icon={Layers} label="Total Courses" value={learning.courses.length} /><SummaryRow icon={CheckCircle2} label="Completed Topics" value={completed} /><SummaryRow icon={Layers} label="In Progress" value={inProgress} /></div></aside>
    </div>
  </div></AppShell>;
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: number }) {
  return <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500"><Icon size={15} />{label}</span><span className="font-semibold text-slate-800">{value}</span></div>;
}
