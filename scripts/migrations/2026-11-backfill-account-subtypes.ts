// scripts/migrations/2026-11-backfill-account-subtypes.ts
// One-off upgrade for databases created before accounts had a statement group
// (subtype). Sets each standard account's group, description and cash flow
// group from the default chart, and adds the accounts the chart gained.
// Safe to run more than once. Run with:
//   npx tsx scripts/migrations/2026-11-backfill-account-subtypes.ts
import prisma from '../../src/lib/prisma';
import { AccountingService, DEFAULT_ACCOUNTS, cashFlowGroupFor } from '../../src/services/accountingService';

async function main() {
  const branches = await prisma.schoolBranch.findMany({ select: { id: true, name: true } });
  for (const branch of branches) {
    let updated = 0;
    for (const seed of DEFAULT_ACCOUNTS) {
      const result = await prisma.account.updateMany({
        where: { branchId: branch.id, code: seed.code },
        data: {
          subtype: seed.subtype,
          description: seed.description ?? null,
          cashFlowGroup: cashFlowGroupFor(seed.subtype, seed.cashFlow),
        },
      });
      updated += result.count;
    }
    const before = await prisma.account.count({ where: { branchId: branch.id } });
    await AccountingService.ensureDefaultAccounts(prisma, branch.id);
    const after = await prisma.account.count({ where: { branchId: branch.id } });
    console.log(`${branch.name}: ${updated} accounts updated, ${after - before} added`);
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
