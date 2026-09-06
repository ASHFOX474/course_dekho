import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";
export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await context.params;
  return workspaceHttpHandlers.rejectSubmission(request, submissionId);
}
