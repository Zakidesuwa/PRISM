'use server';

import { branchAction } from '@/lib/action';
import { AccountingService } from '@/services/accountingService';
import { SurplusService } from '@/services/surplusService';
import { validateRates, type DistributionRates } from '@/lib/surplus/distribution';

export async function createAccountAction(input: { code: string; name: string; type: string; cashFlowGroup?: string }) {
  return branchAction(
    ['MANAGER'],
    (user) => AccountingService.createAccount({ branchId: user.branchId, userId: user.id }, input),
    { revalidate: ['/reports'], message: (account) => `Account ${account.code} ${account.name} added.` }
  );
}

export async function postManualEntryAction(input: {
  description: string;
  debitCode: string;
  creditCode: string;
  amount: string;
}) {
  return branchAction(
    ['MANAGER'],
    (user) => AccountingService.postManualEntry({ branchId: user.branchId, userId: user.id }, input),
    { revalidate: ['/reports', '/analytics', '/dividends'], message: () => 'Journal entry posted.' }
  );
}

export async function finalizeDistributionAction(fiscalYear: number, rates: DistributionRates) {
  return branchAction(
    ['MANAGER'],
    (user) => {
      validateRates(rates);
      return SurplusService.finalize({ branchId: user.branchId, userId: user.id }, fiscalYear, rates);
    },
    { revalidate: ['/dividends', '/reports'], message: (result) => `The ${result.fiscalYear} distribution is finalized.` }
  );
}

export async function reverseDistributionAction(distributionId: number) {
  return branchAction(
    ['MANAGER'],
    (user) => SurplusService.reverse({ branchId: user.branchId, userId: user.id }, distributionId),
    { revalidate: ['/dividends', '/reports'], message: (result) => `The ${result.fiscalYear} distribution was reversed.` }
  );
}
