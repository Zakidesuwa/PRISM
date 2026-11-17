import { requireBranchUser } from '@/lib/authGuard';
import { manilaToday } from '@/lib/dates';
import { AccountingService } from '@/services/accountingService';
import { SurplusService } from '@/services/surplusService';
import DividendsClient from './DividendsClient';

export const metadata = { title: 'Net Surplus Distribution · PRISM' };

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function DividendsPage({ searchParams }: PageProps) {
  const user = await requireBranchUser(['MANAGER']);
  const params = await searchParams;

  const years = await SurplusService.getYears(user.branchId);
  const requested = Number(params.year);
  const year = years.includes(requested) ? requested : years[0];

  const [netSurplus, members, distributions, funds] = await Promise.all([
    SurplusService.getNetSurplus(user.branchId, year),
    SurplusService.getMembers(user.branchId, year),
    SurplusService.listDistributions(user.branchId),
    AccountingService.fundBalances(user.branchId),
  ]);

  return (
    <DividendsClient
      // Remount when the year changes so the inputs pick up that year's figures.
      key={year}
      year={year}
      years={years}
      yearEnded={year < Number(manilaToday().slice(0, 4))}
      booksNetSurplus={netSurplus}
      members={members}
      distributions={distributions}
      funds={funds}
    />
  );
}
