import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return workspaceHttpHandlers.getAdminStats(request); }
