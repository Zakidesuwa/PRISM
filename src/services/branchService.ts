// src/services/branchService.ts
// School cooperatives (the tenants of the system).
import prisma from '@/lib/prisma';
import { num, optionalText, requireText, toAmount } from '@/lib/money';
import { AccountingService } from './accountingService';
import { AuditService } from './auditService';

export interface BranchInput {
  name: string;
  address: string;
  level: string;
  storeLocation?: string;
  contactEmail?: string;
  phone?: string;
  defaultCreditLimit?: unknown;
}

export const BRANCH_LEVELS = ['Elementary', 'High School', 'College'];

function validate(input: BranchInput) {
  if (!BRANCH_LEVELS.includes(input.level)) throw new Error('Choose a school level.');
  return {
    name: requireText(input.name, 'Cooperative name', 100),
    address: requireText(input.address, 'Address', 200),
    level: input.level,
    storeLocation: optionalText(input.storeLocation, 120),
    contactEmail: optionalText(input.contactEmail, 120),
    phone: optionalText(input.phone, 40),
    ...(input.defaultCreditLimit !== undefined && input.defaultCreditLimit !== ''
      ? { defaultCreditLimit: toAmount(input.defaultCreditLimit, 'Default credit limit', { allowZero: true }) }
      : {}),
  };
}

export class BranchService {
  /** Registers a cooperative and gives it the standard chart of accounts. */
  static async create(input: BranchInput, userId: string | null) {
    const data = validate(input);
    return prisma.$transaction(async (tx) => {
      const branch = await tx.schoolBranch.create({ data });
      await AccountingService.ensureDefaultAccounts(tx, branch.id);
      await AuditService.log(
        { branchId: branch.id, userId, action: 'BRANCH_CREATE', entityType: 'SchoolBranch', entityId: branch.id },
        tx
      );
      return { id: branch.id, name: branch.name };
    });
  }

  static async update(id: number, input: BranchInput, userId: string | null) {
    const data = validate(input);
    const branch = await prisma.schoolBranch.update({ where: { id }, data });
    await AuditService.log({
      branchId: id,
      userId,
      action: 'BRANCH_UPDATE',
      entityType: 'SchoolBranch',
      entityId: id,
    });
    return { id: branch.id, name: branch.name };
  }

  static async get(id: number) {
    const branch = await prisma.schoolBranch.findUnique({ where: { id } });
    if (!branch) return null;
    return {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      level: branch.level,
      storeLocation: branch.storeLocation ?? '',
      contactEmail: branch.contactEmail ?? '',
      phone: branch.phone ?? '',
      defaultCreditLimit: num(branch.defaultCreditLimit),
    };
  }

  static async options() {
    return prisma.schoolBranch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }
}
