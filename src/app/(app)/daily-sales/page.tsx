import { requireBranchUser } from '@/lib/authGuard';
import { dayRange, isDateString, manilaToday } from '@/lib/dates';
import { SalesService } from '@/services/salesService';
import { TransactionService } from '@/services/transactionService';
import DailySalesClient from './DailySalesClient';

export const metadata = { title: 'Daily Sales · PRISM' };

interface PageProps {
  searchParams: Promise<{ date?: string; tab?: string }>;
}

export default async function DailySalesPage({ searchParams }: PageProps) {
  const user = await requireBranchUser(['MANAGER', 'CASHIER']);
  const params = await searchParams;

  const today = manilaToday();
  const date = isDateString(params.date) && params.date <= today ? params.date : today;
  const isManager = user.role === 'MANAGER';
  // A cashier reads only their own sales and drawer.
  const scope = isManager ? undefined : user.id;

  const [reading, drawers, sales, vendors] = await Promise.all([
    SalesService.getSalesReading(user.branchId, date, scope),
    SalesService.getDrawers(user.branchId, date, scope),
    TransactionService.list(user.branchId, { range: dayRange(date), cashierId: scope, take: 300 }),
    isManager ? SalesService.getVendorSplit(user.branchId, dayRange(date)) : Promise.resolve([]),
  ]);

  const tab = ['reading', 'cash', 'vendors'].includes(params.tab ?? '') ? params.tab! : 'reading';

  return (
    <DailySalesClient
      date={date}
      today={today}
      tab={tab === 'vendors' && !isManager ? 'reading' : tab}
      isManager={isManager}
      storeName={user.branchName}
      reading={reading}
      drawers={drawers}
      sales={sales}
      vendors={vendors}
    />
  );
}
