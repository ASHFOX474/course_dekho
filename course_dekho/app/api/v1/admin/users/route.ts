import { authHttpHandlers } from "@/lib/server/auth/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return authHttpHandlers.listPendingUsers(request);
}
