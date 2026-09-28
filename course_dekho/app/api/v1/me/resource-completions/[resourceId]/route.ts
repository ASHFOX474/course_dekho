import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";

export async function PUT(request: Request, context: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await context.params;
  return workspaceHttpHandlers.setResourceCompletion(request, resourceId);
}
