"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, Circle } from "lucide-react";

import { ResourceLinkForm } from '@/components/ui/ResourceLinkForm';
import { RemoveResourceButton } from '@/components/ui/RemoveResourceButton';
import { EditResourceButton } from '@/components/ui/EditResourceButton';
import { AppShell } from "@/components/layout/AppShell";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getCourse,
  listCourseResources,
  listCourseTopics,
  courseResourceTypeLabel as resourceTypeLabel,
  type ApprovedResourceDto,
  type CourseSummaryDto,
  type TopicSummaryDto,
} from "@/lib/client/catalog-api";
import { createEnrollment, getLearning } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { cn } from "@/lib/utils";
import { filterCourseResources, matchesCourseSection, topicResourceTypes, type ResourceFilters } from "@/lib/resource-placement";
import type { ResourceType } from "@/lib/server/domain/models";
import { courseSections, type CourseSectionId } from "@/lib/course-sections";

const sectionColors = {
  books: 'border-amber-200 bg-amber-50/70',
  slides: 'border-rose-200 bg-rose-50/70',
  notes: 'border-sky-200 bg-sky-50/70',
  resources: 'border-slate-200 bg-slate-50/70',
};
const emptyFilters: ResourceFilters = { topicId: '', type: '', search: '' };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load this course.";
}

export default function CourseRoadmapPage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isLearner = user?.role === "learner" || user?.role === "contributor";
  const learning = useDatabaseData(
    `course-learning:${user?.id ?? "anonymous"}:${params.courseId}`,
    isLearner ? getLearning : async () => ({ courses: [], topics: [] }),
    { courses: [], topics: [] }
  );
  const [addingResource, setAddingResource] = useState<CourseSectionId | null>(null);
  const [course, setCourse] = useState<CourseSummaryDto | null>(null);
  const [topics, setTopics] = useState<TopicSummaryDto[]>([]);
  const [resources, setResources] = useState<ApprovedResourceDto[]>([]);
  const [activeSection, setActiveSection] = useState<CourseSectionId>("roadmap");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [sectionFilters, setSectionFilters] = useState<Record<string, ResourceFilters>>({});
  const [resolvedCourseId, setResolvedCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isLoading = resolvedCourseId !== params.courseId;

  useEffect(() => {
    if (isAuthLoading || !user) return;
    const controller = new AbortController();

    Promise.all([
      getCourse(params.courseId, controller.signal),
      listCourseTopics(params.courseId, controller.signal),
      listCourseResources(params.courseId, controller.signal),
    ])
      .then(([courseResponse, topicResponse, resourceResponse]) => {
        setCourse(courseResponse);
        setTopics(topicResponse);
        setResources(resourceResponse);
        setSectionFilters({});
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvedCourseId(params.courseId);
      });

    return () => controller.abort();
  }, [isAuthLoading, params.courseId, user]);

  const selectedTopic =
    topics.find((topic) => topic.id === selectedTopicId) ?? topics[0];
  const enrolled = learning.data.courses.some((item) => item.courseId === params.courseId);
  function navigateToSection(section: CourseSectionId) {
    setActiveSection(section);
    const target = document.getElementById(`course-${section}`);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }

  async function enroll() {
    try {
      await createEnrollment(params.courseId);
      learning.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  if (isLoading || isAuthLoading) {
    return (
      <AppShell title="Course">
        <p className="text-sm text-slate-400">Loading course roadmap...</p>
      </AppShell>
    );
  }

  if (!course || error) {
    return (
      <AppShell title="Course not found">
        <p role="alert" className="text-sm text-slate-500">
          {error ?? "We couldn't find that course."}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title={course.code} courseNavigation={{ activeId: activeSection, onSelect: navigateToSection }}>
      <div className="space-y-5">
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/courses" className="hover:text-violet-600">
            Courses
          </Link>
          <ChevronRight size={12} />
          <span className="text-slate-600">{course.code}</span>
        </p>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
          <h2 className="text-lg font-bold text-slate-900">
            {course.code}: {course.name}
          </h2>
          {course.description && (
            <p className="mt-1 max-w-3xl text-sm text-slate-500">{course.description}</p>
          )}
          </div>
          {isLearner && <button type="button" disabled={enrolled} onClick={() => void enroll()} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-emerald-100 disabled:text-emerald-700">{enrolled ? "Enrolled" : "Enroll in course"}</button>}
        </div>

        <nav aria-label="Course sections" className="flex flex-wrap gap-1 border-b border-slate-200">
          {courseSections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateToSection(item.id)}
              aria-controls={`course-${item.id}`}
              aria-current={activeSection === item.id ? 'location' : undefined}
              className={cn(
                "border-b-2 px-3 pb-2.5 text-sm font-medium capitalize transition-colors",
                activeSection === item.id
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <section id="course-roadmap" tabIndex={-1} aria-labelledby="roadmap-heading" className="scroll-mt-24 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          <h3 id="roadmap-heading" className="mb-3 text-lg font-bold text-slate-900">Roadmap</h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
            <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {topics.map((topic) => {
                const isSelected = topic.id === selectedTopic?.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopicId(topic.id)}
                    onDoubleClick={() => router.push(`/courses/${course.id}/topics/${topic.id}`)}
                    title="Click to preview; double-click to open topic resources"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isSelected ? "bg-violet-50" : "hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isSelected
                          ? "bg-violet-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {topic.sequenceOrder}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm font-medium",
                        isSelected ? "text-violet-700" : "text-slate-700"
                      )}
                    >
                      {topic.name}
                    </span>
                    <Circle size={14} className="text-slate-300" />
                  </button>
                );
              })}

              {topics.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">
                  No active topics are available.
                </p>
              )}
            </div>

            {selectedTopic ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-bold text-slate-900">{selectedTopic.name}</h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  {selectedTopic.description}
                </p>

                <div className="my-5 border-t border-slate-100" />

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Topics in this section
                </p>
                {selectedTopic.subtopics.length > 0 ? (
                  <ul className="mb-5 space-y-2">
                    {selectedTopic.subtopics.map((subtopic) => (
                      <li key={subtopic} className="text-sm text-slate-600">
                        {subtopic}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-5 text-sm text-slate-400">No active subtopics.</p>
                )}

                <Link
                  href={`/courses/${course.id}/topics/${selectedTopic.id}`}
                  className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  {user?.role === 'admin' ? 'Manage resources' : 'View Resources'}
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-400 shadow-sm">
                This course does not have an active roadmap yet.
              </div>
            )}
          </div>
        </section>

        {courseSections.filter(section => section.id !== 'roadmap').map(section => {
          const filters = section.id === 'resources' ? sectionFilters[section.id] ?? emptyFilters : emptyFilters;
          const updateFilters = (changes: Partial<ResourceFilters>) => setSectionFilters(current => ({
            ...current, [section.id]: { ...(current[section.id] ?? emptyFilters), ...changes },
          }));
          const sectionTotal = resources.filter(resource => matchesCourseSection(resource.type, section.id)).length;
          const visibleResources = filterCourseResources(resources, section.id, filters);
          const hasFilters = Boolean(filters.topicId || filters.type || filters.search);
          const formTypes: readonly ResourceType[] = section.id === 'notes' ? ['study_material']
            : section.id === 'books' ? ['book'] : section.id === 'slides' ? ['slide'] : topicResourceTypes;
          return <section key={section.id} id={`course-${section.id}`} tabIndex={-1} aria-labelledby={`${section.id}-heading`}
            className={cn('scroll-mt-24 space-y-4 rounded-2xl border p-5 outline-none transition-[transform,box-shadow] duration-300 motion-reduce:transform-none motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-violet-400',
              sectionColors[section.id], activeSection === section.id && 'scale-[1.01] shadow-lg ring-2 ring-violet-400/60')}>
            <div className="flex items-center justify-between gap-3">
              <h3 id={`${section.id}-heading`} className="text-lg font-bold text-slate-900">{section.label}</h3>
              <span role="status" className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">{section.id === 'resources' ? `${visibleResources.length} of ${sectionTotal}` : sectionTotal} resources</span>
            </div>
            {section.id === 'resources' && <div role="group" aria-label={`${section.label} filters`} className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1 text-sm font-medium">Search {section.label.toLowerCase()}
                <input type="search" value={filters.search} onChange={event => updateFilters({ search: event.target.value })}
                  placeholder="Search title or description" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
              </label>
              <label className="text-sm font-medium">Filter by topic
                <select value={filters.topicId} onChange={event => updateFilters({ topicId: event.target.value })}
                  className="mt-1 block w-full max-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">All topics</option>
                  {topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                </select>
              </label>
              {section.id === 'resources' && <label className="text-sm font-medium">Filter by type
                <select value={filters.type} onChange={event => updateFilters({ type: event.target.value })}
                  className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">All types</option>
                  {topicResourceTypes.map(type => <option key={type} value={type}>{resourceTypeLabel(type)}</option>)}
                </select>
              </label>}
              {hasFilters && <button type="button" onClick={() => updateFilters(emptyFilters)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">Clear filters</button>}
            </div>}
        {user?.role === 'admin' && <div className="rounded-xl bg-white/70 p-4">
          {section.id === 'resources' && <label className="text-sm font-medium">Topic for new resource
            <select className="ml-3 max-w-full rounded-lg border p-2" value={selectedTopic?.id ?? ''} onChange={event => { setSelectedTopicId(event.target.value); setAddingResource(null); }}>
              {!topics.length && <option value="">No active topics</option>}
              {topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
            </select>
          </label>}
          <button disabled={!selectedTopic} className="action-primary ml-3" onClick={() => setAddingResource(section.id)}>Add resource link</button>
          {addingResource === section.id && selectedTopic && <ResourceLinkForm key={`${section.id}:${selectedTopic.id}`} courseId={course.id} topicId={selectedTopic.id} topicName={section.id !== 'resources' ? course.name : selectedTopic.name} resourceTypes={formTypes} defaultResourceType={formTypes.find(type => type === filters.type)} onClose={() => setAddingResource(null)} onSaved={() => { setAddingResource(null); void listCourseResources(course.id).then(setResources).catch(err => setError(errorMessage(err))); }} />}
        </div>}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Topic</th>
                  <th className="px-4 py-3 font-medium">Added By</th>
                  {user?.role === 'admin' && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleResources.map((resource) => {
                  const topic = topics.find((item) => item.id === resource.topicId);
                  const displayType = resourceTypeLabel(resource.type);
                  return (
                    <tr key={resource.id} className="cursor-pointer hover:bg-slate-50"
                      title="Double-click to open resource"
                      onDoubleClick={event => {
                        if ((event.target as Element).closest('a, button, input, select, textarea')) return;
                        router.push(`/resources/${resource.id}`);
                      }}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/resources/${resource.id}`}
                          className="flex items-center gap-2 font-medium text-slate-700 hover:text-violet-700"
                        >
                          <ResourceTypeIcon type={displayType} />
                          {resource.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{displayType}</td>
                      <td className="px-4 py-3 text-slate-500">{topic?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{resource.addedBy.name}</td>
                      {user?.role === 'admin' && <td className="px-4 py-3"><div className="flex gap-2"><EditResourceButton resource={resource} onSaved={() => { void listCourseResources(course.id).then(setResources).catch(err => setError(errorMessage(err))); }} /><RemoveResourceButton resourceId={resource.id} title={resource.title} onRemoved={() => setResources(current => current.filter(item => item.id !== resource.id))} /></div></td>}
                    </tr>
                  );
                })}
                {visibleResources.length === 0 && (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 5 : 4} className="px-4 py-8 text-center text-sm text-slate-400">
                      {hasFilters ? 'No resources match these filters. Try another topic or clear the filters.' : 'No approved active resources are available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>;
        })}

      </div>
    </AppShell>
  );
}
