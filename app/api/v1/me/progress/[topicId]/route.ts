import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";
export async function PUT(request: Request, context: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await context.params;
  return workspaceHttpHandlers.updateProgress(request, topicId);
}
