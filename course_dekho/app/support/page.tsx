import { SupportWorkspace } from '@/components/support/SupportWorkspace';
import { requirePageUser } from '@/lib/server/auth/page-guard';

export default async function SupportPage() {
  await requirePageUser();
  return <SupportWorkspace />;
}
