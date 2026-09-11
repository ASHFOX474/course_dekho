export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ resourceId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { resourceId } = await context.params;
  const { catalogHttpHandlers } = await import("@/lib/server/catalog/runtime");
  return catalogHttpHandlers.getApprovedResource(request, resourceId);
}
