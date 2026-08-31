export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const { authHttpHandlers } = await import("@/lib/server/auth/runtime");
  return authHttpHandlers.session(request);
}
