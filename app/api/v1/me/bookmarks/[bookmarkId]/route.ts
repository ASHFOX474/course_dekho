import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";
export async function DELETE(request: Request, context: { params: Promise<{ bookmarkId: string }> }) {
  const { bookmarkId } = await context.params;
  return workspaceHttpHandlers.deleteBookmark(request, bookmarkId);
}
