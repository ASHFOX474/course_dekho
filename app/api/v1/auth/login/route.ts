export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const { authHttpHandlers } = await import("@/lib/server/auth/runtime");
  return authHttpHandlers.login(request);
}
