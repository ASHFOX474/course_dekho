export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { accountHandler } = await import('@/lib/server/auth/account-runtime');
  return accountHandler(request, 'issue', (await context.params).userId);
}
