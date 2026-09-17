"use client";
import Link from "next/link";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { listOwnSubmissions } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
export default function ContributorCoursesPage() {
  const { user } = useAuth();
  const submissions = useDatabaseData(`contributor-courses:${user?.id}`, listOwnSubmissions, []);
  const courses = [...new Map(submissions.data.map(row => [row.courseId, { id: row.courseId, code: row.courseCode }])).values()];
  return <AppShell title="Course workspace" allowedRoles={["contributor"]}><div className="space-y-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker mb-2">Contributor studio</p><h2 className="page-title">Your teaching footprint</h2><p className="mt-3 text-sm text-slate-500">Courses you have contributed to, with your review status at a glance.</p></div><Link href="/courses" className="action-secondary">Browse all courses <ArrowUpRight size={15} /></Link></div>{submissions.error && <p role="alert" className="text-sm text-rose-600">{submissions.error}</p>}<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{courses.map(course => { const rows = submissions.data.filter(row => row.courseId === course.id); return <section key={course.id} className="panel p-6"><BookOpen size={26} className="mb-5 text-emerald-700" /><h3 className="text-xl font-semibold">{course.code}</h3><div className="my-5 grid grid-cols-3 gap-2 border-y border-slate-100 py-4">{(["pending", "approved", "rejected"] as const).map(status => <div key={status}><strong className="text-xl">{rows.filter(row => row.status === status).length}</strong><p className="mt-1 text-[10px] capitalize text-slate-400">{status}</p></div>)}</div><Link href={`/courses/${course.id}`} className="text-xs font-semibold text-emerald-800">Open course roadmap →</Link></section>; })}</div>{!courses.length && <section className="rounded-2xl border border-dashed border-emerald-900/20 p-10 text-center"><h3 className="text-lg font-semibold">Your first contribution starts here</h3><p className="mx-auto mt-3 max-w-md text-sm text-slate-500">Choose an existing course and topic, then submit your material for review. Admins manage the official course structure.</p><Link href="/contributor/submissions" className="action-primary mt-6">Open submissions</Link></section>}</div></AppShell>;
}
