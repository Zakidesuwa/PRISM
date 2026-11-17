'use server';

import { branchAction } from '@/lib/action';
import { AccountingService, type ManualEntryInput } from '@/services/accountingService';
import { SurplusService } from '@/services/surplusService';
import { validateRates, type DistributionRates } from '@/lib/surplus/distribution';

export async function createAccountAction(input: {
  code: string;
  name: string;
  subtype: string;
  description?: string;
  cashFlow?: string;
}) {
  return branchAction(
    ['MANAGER'],
    (user) => AccountingService.createAccount({ branchId: user.branchId, userId: user.id }, input),
    { revalidate: ['/reports'], message: (account) => `Account ${account.code} ${account.name} added.` }
  );
}

export async function postManualEntryAction(input: ManualEntryInput) {
  return branchAction(
    ['MANAGER'],
    (user) => AccountingService.postManualEntry({ branchId: user.branchId, userId: user.id }, input),
    { revalidate: ['/reports', '/analytics', '/dividends'], message: () => 'Journal entry posted.' }
  );
}

export async function reverseJournalEntryAction(entryId: number, reason: string) {
  return branchAction(
    ['MANAGER'],
    (user) => AccountingService.reverseManualEntry({ branchId: user.branchId, userId: user.id }, entryId, reason),
    { revalidate: ['/reports', '/analytics', '/dividends'], message: (result) => `JE-${result.reverses} reversed.` }
  );
}

export async function setAccountActiveAction(accountId: number, isActive: boolean) {
  return branchAction(
    ['MANAGER'],
    (user) => AccountingService.setAccountActive({ branchId: user.branchId, userId: user.id }, accountId, isActive),
    {
      revalidate: ['/reports'],
      message: (result) => `Account ${result.code} ${result.isActive ? 'reactivated' : 'deactivated'}.`,
    }
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
