import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";
export async function POST(request: Request) { return workspaceHttpHandlers.createEnrollment(request); }
