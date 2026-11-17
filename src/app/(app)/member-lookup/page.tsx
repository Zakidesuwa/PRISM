import { requireBranchUser } from '@/lib/authGuard';
import MemberLookupClient from './MemberLookupClient';

export const metadata = { title: 'Member Lookup · PRISM' };

export default async function MemberLookupPage() {
  await requireBranchUser(['MANAGER', 'CASHIER']);
  return <MemberLookupClient />;
}
