import { attachmentHandler } from '@/lib/server/storage/runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ resourceId: string }> }) {
  return attachmentHandler(request, (await context.params).resourceId, 'resources');
}
