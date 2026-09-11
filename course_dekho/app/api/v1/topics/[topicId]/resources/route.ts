export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ topicId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { topicId } = await context.params;
  const { catalogHttpHandlers } = await import("@/lib/server/catalog/runtime");
  return catalogHttpHandlers.listTopicResources(request, topicId);
}
