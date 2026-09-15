import { attachmentHandler } from '@/lib/server/storage/runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  return attachmentHandler(request, (await context.params).submissionId, 'submissions');
}
