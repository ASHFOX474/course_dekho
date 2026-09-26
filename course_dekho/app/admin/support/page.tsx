import { SupportWorkspace } from '@/components/support/SupportWorkspace';
import { requirePageUser } from '@/lib/server/auth/page-guard';

export default async function AdminSupportPage() {
  await requirePageUser(['admin']);
  return <SupportWorkspace admin />;
}
