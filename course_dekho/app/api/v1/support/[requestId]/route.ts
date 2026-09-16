import { supportHandler } from '@/lib/server/support/runtime';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ requestId: string }> };
export async function GET(request: Request, context: Context) { return supportHandler(request, 'thread', (await context.params).requestId); }
export async function POST(request: Request, context: Context) { return supportHandler(request, 'thread', (await context.params).requestId); }
