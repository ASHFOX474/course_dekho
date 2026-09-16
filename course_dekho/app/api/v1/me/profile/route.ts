import { workspaceHttpHandlers } from "@/lib/server/workspace/runtime";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return workspaceHttpHandlers.getProfile(request); }
export async function PUT(request: Request) {
  const { accountHandler } = await import('@/lib/server/auth/account-runtime');
  return accountHandler(request, 'profile');
}
