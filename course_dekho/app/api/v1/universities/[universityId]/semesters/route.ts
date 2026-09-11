export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ universityId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { universityId } = await context.params;
  const { catalogHttpHandlers } = await import("@/lib/server/catalog/runtime");
  return catalogHttpHandlers.listSemesters(request, universityId);
}
