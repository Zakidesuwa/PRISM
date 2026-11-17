import { requireBranchUser } from '@/lib/authGuard';
import { BranchService } from '@/services/branchService';
import { MemberService } from '@/services/memberService';
import MembersClient from './MembersClient';

export const metadata = { title: 'Coop Members · PRISM' };

export default async function MembersPage() {
  const user = await requireBranchUser(['MANAGER']);
  const [members, branch] = await Promise.all([MemberService.list(user.branchId), BranchService.get(user.branchId)]);

  return <MembersClient members={members} defaultCreditLimit={branch?.defaultCreditLimit ?? 0} />;
}
