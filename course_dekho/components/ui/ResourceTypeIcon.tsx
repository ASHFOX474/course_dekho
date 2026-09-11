import { BookOpen, Code2, FileQuestion, FileText, Layers, Notebook, PlayCircle } from "lucide-react";
import { ResourceType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Maps each resource type to its icon + Tailwind color classes. */
const resourceTypeConfig: Record<ResourceType, { icon: typeof FileText; classes: string }> = {
  "Study Material": { icon: Notebook, classes: "bg-sky-50 text-sky-600" },
  "Practice Material": { icon: FileText, classes: "bg-emerald-50 text-emerald-600" },
  Book: { icon: BookOpen, classes: "bg-amber-50 text-amber-600" },
  Tutorial: { icon: PlayCircle, classes: "bg-violet-50 text-violet-600" },
  Slide: { icon: Layers, classes: "bg-rose-50 text-rose-600" },
  Question: { icon: FileQuestion, classes: "bg-orange-50 text-orange-600" },
  "LeetCode Problem": { icon: Code2, classes: "bg-slate-100 text-slate-700" },
};

export function ResourceTypeIcon({ type, size = 16 }: { type: ResourceType; size?: number }) {
  const { icon: Icon, classes } = resourceTypeConfig[type];
  return (
    <span className={cn("inline-flex items-center justify-center rounded-md p-1.5", classes)}>
      <Icon size={size} />
    </span>
  );
}

export { resourceTypeConfig };
