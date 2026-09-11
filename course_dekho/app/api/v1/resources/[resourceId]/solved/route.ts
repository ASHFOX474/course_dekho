import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";
export async function POST(request: Request, context: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await context.params;
  return workspaceHttpHandlers.markSolved(request, resourceId);
}
