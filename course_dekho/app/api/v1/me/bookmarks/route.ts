import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return workspaceHttpHandlers.listBookmarks(request); }
export async function POST(request: Request) { return workspaceHttpHandlers.createBookmark(request); }
