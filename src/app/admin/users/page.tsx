import UsersManager from '@/components/UsersManager/UsersManager';
import { requireRole } from '@/lib/authGuard';
import { BranchService } from '@/services/branchService';
import { UserService } from '@/services/userService';

export default async function AdminUsersPage() {
  const admin = await requireRole(['ADMIN']);
  const [users, branches] = await Promise.all([UserService.list(admin), BranchService.options()]);

  return <UsersManager users={users} currentUserId={admin.id} branches={branches} />;
}
