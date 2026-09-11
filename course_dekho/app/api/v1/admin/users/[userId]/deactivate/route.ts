import { authHttpHandlers } from "@/lib/server/auth/runtime";

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  return authHttpHandlers.deactivateUser(request, userId);
}
