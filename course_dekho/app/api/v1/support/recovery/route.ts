import { supportHandler } from '@/lib/server/support/runtime';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return supportHandler(request, 'recovery'); }
