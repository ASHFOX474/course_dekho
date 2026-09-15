export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const { pool } = await import('@/lib/db');
  const { AuthService } = await import('@/lib/server/auth/service');
  const { createAdminCourseHandler } = await import('@/lib/server/catalog/admin-http-handlers');
  return createAdminCourseHandler(pool, new AuthService({ pool }), process.env.APP_ORIGIN)(request);
}
