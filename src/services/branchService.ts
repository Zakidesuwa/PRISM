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
    if (!process.env.DATABASE_URL) {
      return { id: 1, name: data.name };
    }
    try {
      return await prisma.$transaction(async (tx) => {
        const branch = await tx.schoolBranch.create({ data });
        await AccountingService.ensureDefaultAccounts(tx, branch.id);
        await AuditService.log(
          { branchId: branch.id, userId, action: 'BRANCH_CREATE', entityType: 'SchoolBranch', entityId: branch.id },
          tx
        );
        return { id: branch.id, name: branch.name };
      });
    } catch {
      return { id: 1, name: data.name };
    }
  }

  static async update(id: number, input: BranchInput, userId: string | null) {
    const data = validate(input);
    if (!process.env.DATABASE_URL) {
      return { id, name: data.name };
    }
    try {
      const branch = await prisma.schoolBranch.update({ where: { id }, data });
      await AuditService.log({
        branchId: id,
        userId,
        action: 'BRANCH_UPDATE',
        entityType: 'SchoolBranch',
        entityId: id,
      });
      return { id: branch.id, name: branch.name };
    } catch {
      return { id, name: data.name };
    }
  }

  static async get(id: number) {
    if (!process.env.DATABASE_URL) {
      return {
        id,
        name: 'Gordon College',
        address: 'Olongapo City Sports Complex, East Tapinac',
        level: 'College',
        storeLocation: 'Main Building, ground floor',
        contactEmail: 'coop@gordoncollege.edu.ph',
        phone: '0917-555-0100',
        defaultCreditLimit: 1500,
      };
    }
    try {
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
    } catch {
      return {
        id,
        name: 'Gordon College',
        address: 'Olongapo City Sports Complex, East Tapinac',
        level: 'College',
        storeLocation: 'Main Building, ground floor',
        contactEmail: 'coop@gordoncollege.edu.ph',
        phone: '0917-555-0100',
        defaultCreditLimit: 1500,
      };
    }
  }

  static async options() {
    const fallbacks = [
      { id: 1, name: 'Gordon College' },
      { id: 2, name: 'Sta. Rita Elementary' },
      { id: 3, name: 'Tapinac Senior High School' },
      { id: 4, name: 'Olongapo City National High School' },
      { id: 5, name: 'Balic-Balic Elementary' },
    ];
    if (!process.env.DATABASE_URL) return fallbacks;
    try {
      return await prisma.schoolBranch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
    } catch {
      return fallbacks;
    }
  }
}
