export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const { accountHandler } = await import('@/lib/server/auth/account-runtime');
  return accountHandler(request, 'password');
}
