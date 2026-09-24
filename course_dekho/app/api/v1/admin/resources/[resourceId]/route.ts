import { workspaceHttpHandlers } from '@/lib/server/workspace/runtime';
export async function PATCH(request: Request, context: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await context.params;
  return workspaceHttpHandlers.editResource(request, resourceId);
}
export async function DELETE(request: Request, context: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await context.params;
  return workspaceHttpHandlers.removeResource(request, resourceId);
}
