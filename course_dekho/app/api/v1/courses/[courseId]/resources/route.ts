export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { courseId } = await context.params;
  const { catalogHttpHandlers } = await import("@/lib/server/catalog/runtime");
  return catalogHttpHandlers.listCourseResources(request, courseId);
}
