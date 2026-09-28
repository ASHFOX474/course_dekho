import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return workspaceHttpHandlers.getDisplayPreference(request);
}

export async function PUT(request: Request) {
  return workspaceHttpHandlers.updateDisplayPreference(request);
}
