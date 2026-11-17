import { requireBranchUser } from '@/lib/authGuard';
import { DashboardService } from '@/services/dashboardService';
import AnalyticsClient from './AnalyticsClient';

export const metadata = { title: 'Profit Analytics · PRISM' };

export default async function AnalyticsPage() {
  const user = await requireBranchUser(['MANAGER']);
  const data = await DashboardService.getAnalytics(user.branchId);
  return <AnalyticsClient data={data} />;
}
