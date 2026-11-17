import ui from '@/styles/ui.module.css';
import UsersManager from '@/components/UsersManager/UsersManager';
import { requireBranchUser } from '@/lib/authGuard';
import { UserService } from '@/services/userService';

export const metadata = { title: 'Users · PRISM' };

export default async function UsersPage() {
  const user = await requireBranchUser(['MANAGER']);
  const users = await UserService.list(user);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>Users</h1>
          <p className={ui.subtitle}>Cashiers, store keepers and managers of {user.branchName}.</p>
        </div>
      </div>
      <UsersManager users={users} currentUserId={user.id} />
    </div>
  );
}
