export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const { catalogHttpHandlers } = await import("@/lib/server/catalog/runtime");
  return catalogHttpHandlers.listCourses(request);
}
