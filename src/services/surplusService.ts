// src/services/surplusService.ts
import prisma from '@/lib/prisma';
import { DistributionMember, parseMoneyToCentavos } from '@/lib/surplus/distribution';

export class SurplusService {
  /**
   * Loads every cooperative member with the two figures the surplus
   * distribution is based on: accumulated patronage and share capital.
   */
  static async getDistributionMembers(): Promise<DistributionMember[]> {
    const members = await prisma.coopMember.findMany({
      orderBy: { fullName: 'asc' },
      include: { branch: { select: { name: true } } },
    });

    return members.map((member) => ({
      id: member.id,
      memberCode: member.memberCode,
      fullName: member.fullName,
      branchName: member.branch.name,
      status: member.status,
      patronageCentavos: parseMoneyToCentavos(member.accumulatedPatronage.toFixed(2)) ?? 0,
      shareCapitalCentavos: parseMoneyToCentavos(member.shareCapital.toFixed(2)) ?? 0,
    }));
  }
}
