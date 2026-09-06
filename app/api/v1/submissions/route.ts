import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return workspaceHttpHandlers.createSubmission(request); }
