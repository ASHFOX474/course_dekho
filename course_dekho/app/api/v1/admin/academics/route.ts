export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  const { pool } = await import('@/lib/db');
  const { AuthService } = await import('@/lib/server/auth/service');
  const { createAcademicHandler } = await import('@/lib/server/catalog/academic-http-handlers');
  return createAcademicHandler(pool, new AuthService({ pool }), process.env.APP_ORIGIN)(request);
}

export const GET = handle;
export const POST = handle;
