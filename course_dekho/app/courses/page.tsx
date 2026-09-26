import { requirePageUser } from '@/lib/server/auth/page-guard';
import PageClient from './page-client';

export default async function Page() {
  await requirePageUser();
  return <PageClient />;
}
