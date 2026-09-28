import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";

export async function POST(request: Request, context: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await context.params;
  return workspaceHttpHandlers.rejectEnrollment(request, enrollmentId);
}
