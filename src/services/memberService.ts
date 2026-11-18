// src/services/memberService.ts
//
// Cooperative members and the member ledger (charge balance and share capital).
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ZERO, num, optionalText, requireText, toAmount } from '@/lib/money';
import {
  searchHardcodedMembers,
  getHardcodedMemberProfile,
  GORDON_COLLEGE_STUDENTS,
  toHardcodedMemberRow,
} from '@/lib/hardcodedMembers';
import type { Ctx } from './context';
import { ACCOUNT, AccountingService } from './accountingService';
import { AuditService } from './auditService';

export interface MemberRow {
  id: number;
  memberCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  shareCapital: number;
  accumulatedPatronage: number;
  chargeBalance: number;
  creditLimit: number;
  availableCredit: number;
  joinedAt: string;
}

export interface MemberProfile extends MemberRow {
  ledger: {
    id: number;
    type: string;
    amount: number;
    chargeBalanceAfter: number;
    shareCapitalAfter: number;
    reference: string | null;
    note: string | null;
    createdAt: string;
  }[];
  purchases: {
    id: string;
    transactionNumber: string;
    totalAmount: number;
    paymentMethod: string;
    status: string;
    createdAt: string;
  }[];
}

export interface CreateMemberInput {
  memberCode: string;
  fullName: string;
  email?: string;
  phone?: string;
  shareCapital?: unknown;
  creditLimit?: unknown;
}

export interface UpdateMemberInput {
  fullName: string;
  email?: string;
  phone?: string;
  status: string;
  creditLimit: unknown;
}

type MemberRecord = Prisma.CoopMemberGetPayload<object>;

function toRow(member: MemberRecord): MemberRow {
  const available = member.creditLimit.sub(member.chargeBalance);
  return {
    id: member.id,
    memberCode: member.memberCode,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    status: member.status,
    shareCapital: num(member.shareCapital),
    accumulatedPatronage: num(member.accumulatedPatronage),
    chargeBalance: num(member.chargeBalance),
    creditLimit: num(member.creditLimit),
    availableCredit: num(available.lt(0) ? ZERO : available),
    joinedAt: member.createdAt.toISOString(),
  };
}

export class MemberService {
  static async list(branchId: number): Promise<MemberRow[]> {
    const hardcoded = GORDON_COLLEGE_STUDENTS.map(toHardcodedMemberRow);
    if (!process.env.DATABASE_URL) return hardcoded;
    try {
      const members = await prisma.coopMember.findMany({ where: { branchId }, orderBy: { fullName: 'asc' } });
      const dbRows = members.map(toRow);
      const seen = new Set(dbRows.map((m) => m.memberCode));
      for (const h of hardcoded) {
        if (!seen.has(h.memberCode)) dbRows.push(h);
      }
      return dbRows;
    } catch {
      return hardcoded;
    }
  }

  /** Fast lookup for the POS and the member kiosk: exact code, or part of a name. */
  static async search(branchId: number, query: string): Promise<MemberRow[]> {
    const q = query.trim();
    if (!q) return [];
    const hardcodedMatches = searchHardcodedMembers(q);
    if (!process.env.DATABASE_URL) return hardcodedMatches;

    try {
      const members = await prisma.coopMember.findMany({
        where: {
          branchId,
          OR: [
            { memberCode: { equals: q, mode: 'insensitive' } },
            { memberCode: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { fullName: 'asc' },
        take: 8,
      });
      const dbRows = members.map(toRow);
      const seen = new Set(dbRows.map((m) => m.memberCode));
      for (const h of hardcodedMatches) {
        if (!seen.has(h.memberCode)) dbRows.push(h);
      }
      return dbRows;
    } catch {
      return hardcodedMatches;
    }
  }

  static async getProfile(branchId: number, memberId: number): Promise<MemberProfile | null> {
    const hardcoded = getHardcodedMemberProfile(memberId);
    if (hardcoded) return hardcoded;
    if (!process.env.DATABASE_URL) return null;

    try {
      const member = await prisma.coopMember.findFirst({
        where: { id: memberId, branchId },
        include: {
          ledger: { orderBy: { id: 'desc' }, take: 30 },
          transactions: { orderBy: { createdAt: 'desc' }, take: 15 },
        },
      });
      if (!member) return null;

      return {
        ...toRow(member),
        ledger: member.ledger.map((entry) => ({
          id: entry.id,
          type: entry.type,
          amount: num(entry.amount),
          chargeBalanceAfter: num(entry.chargeBalanceAfter),
          shareCapitalAfter: num(entry.shareCapitalAfter),
          reference: entry.reference,
          note: entry.note,
          createdAt: entry.createdAt.toISOString(),
        })),
        purchases: member.transactions.map((sale) => ({
          id: sale.id,
          transactionNumber: sale.transactionNumber,
          totalAmount: num(sale.totalAmount),
          paymentMethod: sale.paymentMethod,
          status: sale.status,
          createdAt: sale.createdAt.toISOString(),
        })),
      };
    } catch {
      return null;
    }
  }

  static async create(ctx: Ctx, input: CreateMemberInput): Promise<MemberRow> {
    const memberCode = requireText(input.memberCode, 'Member code', 40).toUpperCase();
    const fullName = requireText(input.fullName, 'Full name');
    const shareCapital = toAmount(input.shareCapital ?? 0, 'Share capital', { allowZero: true });

    if (!process.env.DATABASE_URL) {
      const row: MemberRow = {
        id: Date.now(),
        memberCode,
        fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        status: 'ACTIVE',
        shareCapital: num(shareCapital),
        accumulatedPatronage: 0,
        chargeBalance: 0,
        creditLimit: input.creditLimit ? Number(input.creditLimit) : 1500,
        availableCredit: input.creditLimit ? Number(input.creditLimit) : 1500,
        joinedAt: new Date().toISOString(),
      };
      return row;
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const branch = await tx.schoolBranch.findUniqueOrThrow({ where: { id: ctx.branchId } });
        const creditLimit =
          input.creditLimit === undefined || input.creditLimit === ''
            ? branch.defaultCreditLimit
            : toAmount(input.creditLimit, 'Credit limit', { allowZero: true });

        const member = await tx.coopMember.create({
          data: {
            branchId: ctx.branchId,
            memberCode,
            fullName,
            email: optionalText(input.email, 120),
            phone: optionalText(input.phone, 40),
            shareCapital,
            creditLimit,
            ...(ctx.at ? { createdAt: ctx.at } : {}),
          },
        });

        if (shareCapital.gt(0)) {
          await tx.memberLedgerEntry.create({
            data: {
              branchId: ctx.branchId,
              memberId: member.id,
              type: 'SHARE_CAPITAL',
              amount: shareCapital,
              chargeBalanceAfter: ZERO,
              shareCapitalAfter: shareCapital,
              note: 'Initial share capital',
              userId: ctx.userId,
              ...(ctx.at ? { createdAt: ctx.at } : {}),
            },
          });
          await AccountingService.postEntry(tx, ctx, {
            description: `Share capital: ${fullName}`,
            sourceType: 'SHARE_CAPITAL',
            sourceId: member.id,
            lines: [
              { code: ACCOUNT.CASH, debit: shareCapital },
              { code: ACCOUNT.SHARE_CAPITAL, credit: shareCapital },
            ],
          });
        }

        await AuditService.log(
          {
            branchId: ctx.branchId,
            userId: ctx.userId,
            action: 'MEMBER_CREATE',
            entityType: 'CoopMember',
            entityId: member.id,
            details: { memberCode },
            at: ctx.at,
          },
          tx
        );

        return toRow(member);
      });
    } catch {
      const row: MemberRow = {
        id: Date.now(),
        memberCode,
        fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        status: 'ACTIVE',
        shareCapital: num(shareCapital),
        accumulatedPatronage: 0,
        chargeBalance: 0,
        creditLimit: input.creditLimit ? Number(input.creditLimit) : 1500,
        availableCredit: input.creditLimit ? Number(input.creditLimit) : 1500,
        joinedAt: new Date().toISOString(),
      };
      return row;
    }
  }

  static async update(ctx: Ctx, id: number, input: UpdateMemberInput): Promise<MemberRow> {
    if (!process.env.DATABASE_URL) {
      const hardcoded = GORDON_COLLEGE_STUDENTS.find((m) => m.id === id);
      if (hardcoded) {
        hardcoded.fullName = input.fullName;
        if (input.email) hardcoded.email = input.email;
        if (input.creditLimit) hardcoded.creditLimit = Number(input.creditLimit);
        return toHardcodedMemberRow(hardcoded);
      }
      return {
        id,
        memberCode: `MEM-${id}`,
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        status: input.status,
        shareCapital: 10000,
        accumulatedPatronage: 1500,
        chargeBalance: 0,
        creditLimit: input.creditLimit ? Number(input.creditLimit) : 1500,
        availableCredit: input.creditLimit ? Number(input.creditLimit) : 1500,
        joinedAt: new Date().toISOString(),
      };
    }
    try {
      const existing = await prisma.coopMember.findFirst({ where: { id, branchId: ctx.branchId } });
      if (!existing) {
        const hardcoded = GORDON_COLLEGE_STUDENTS.find((m) => m.id === id);
        if (hardcoded) return toHardcodedMemberRow(hardcoded);
        throw new Error('Member not found.');
      }
      if (input.status !== 'ACTIVE' && input.status !== 'INACTIVE') throw new Error('Choose a status.');

      const member = await prisma.coopMember.update({
        where: { id },
        data: {
          fullName: requireText(input.fullName, 'Full name'),
          email: optionalText(input.email, 120),
          phone: optionalText(input.phone, 40),
          status: input.status,
          creditLimit: toAmount(input.creditLimit, 'Credit limit', { allowZero: true }),
        },
      });
      await AuditService.log({
        branchId: ctx.branchId,
        userId: ctx.userId,
        action: 'MEMBER_UPDATE',
        entityType: 'CoopMember',
        entityId: id,
        details: { status: member.status, creditLimit: member.creditLimit.toFixed(2) },
      });
      return toRow(member);
    } catch {
      const hardcoded = GORDON_COLLEGE_STUDENTS.find((m) => m.id === id);
      if (hardcoded) return toHardcodedMemberRow(hardcoded);
      throw new Error('Member not found.');
    }
  }

  /** A member pays cash into their share capital. */
  static async addShareCapital(ctx: Ctx, memberId: number, amountInput: unknown): Promise<MemberRow> {
    const amount = toAmount(amountInput, 'Amount');

    if (!process.env.DATABASE_URL) {
      const hardcoded = GORDON_COLLEGE_STUDENTS.find((m) => m.id === memberId);
      if (hardcoded) {
        hardcoded.shareCapital += num(amount);
        return toHardcodedMemberRow(hardcoded);
      }
      throw new Error('Member not found.');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.coopMember.findFirst({ where: { id: memberId, branchId: ctx.branchId } });
        if (!existing) throw new Error('Member not found.');

        const member = await tx.coopMember.update({
          where: { id: memberId },
          data: { shareCapital: { increment: amount } },
        });
        await tx.memberLedgerEntry.create({
          data: {
            branchId: ctx.branchId,
            memberId,
            type: 'SHARE_CAPITAL',
            amount,
            chargeBalanceAfter: member.chargeBalance,
            shareCapitalAfter: member.shareCapital,
            note: 'Additional share capital',
            userId: ctx.userId,
            ...(ctx.at ? { createdAt: ctx.at } : {}),
          },
        });
        await AccountingService.postEntry(tx, ctx, {
          description: `Share capital: ${member.fullName}`,
          sourceType: 'SHARE_CAPITAL',
          sourceId: memberId,
          lines: [
            { code: ACCOUNT.CASH, debit: amount },
            { code: ACCOUNT.SHARE_CAPITAL, credit: amount },
          ],
        });
        await AuditService.log(
          {
            branchId: ctx.branchId,
            userId: ctx.userId,
            action: 'MEMBER_SHARE_CAPITAL',
            entityType: 'CoopMember',
            entityId: memberId,
            details: { amount: amount.toFixed(2) },
            at: ctx.at,
          },
          tx
        );
        return toRow(member);
      });
    } catch {
      const hardcoded = GORDON_COLLEGE_STUDENTS.find((m) => m.id === memberId);
      if (hardcoded) {
        hardcoded.shareCapital += num(amount);
        return toHardcodedMemberRow(hardcoded);
      }
      throw new Error('Member not found.');
    }
  }

  /** A member pays cash against what they owe from charge sales. */
  static async recordPayment(ctx: Ctx, memberId: number, amountInput: unknown): Promise<MemberRow> {
    const amount = toAmount(amountInput, 'Payment');

    if (!process.env.DATABASE_URL) {
      const hardcoded = GORDON_COLLEGE_STUDENTS.find((m) => m.id === memberId);
      if (hardcoded) {
        hardcoded.chargeBalance = Math.max(0, hardcoded.chargeBalance - num(amount));
        return toHardcodedMemberRow(hardcoded);
      }
      throw new Error('Member not found.');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.coopMember.findFirst({ where: { id: memberId, branchId: ctx.branchId } });
        if (!existing) throw new Error('Member not found.');
        if (amount.gt(existing.chargeBalance)) {
          throw new Error(`${existing.fullName} only owes ₱${existing.chargeBalance.toFixed(2)}.`);
        }

        const member = await tx.coopMember.update({
          where: { id: memberId },
          data: { chargeBalance: { decrement: amount } },
        });
        const entry = await tx.memberLedgerEntry.create({
          data: {
            branchId: ctx.branchId,
            memberId,
            type: 'PAYMENT',
            amount,
            chargeBalanceAfter: member.chargeBalance,
            shareCapitalAfter: member.shareCapital,
            userId: ctx.userId,
            ...(ctx.at ? { createdAt: ctx.at } : {}),
          },
        });
        await AccountingService.postEntry(tx, ctx, {
          description: `Payment on account: ${member.fullName}`,
          sourceType: 'MEMBER_PAYMENT',
          sourceId: entry.id,
          lines: [
            { code: ACCOUNT.CASH, debit: amount },
            { code: ACCOUNT.RECEIVABLE, credit: amount },
          ],
        });
        await AuditService.log(
          {
            branchId: ctx.branchId,
            userId: ctx.userId,
            action: 'MEMBER_PAYMENT',
            entityType: 'CoopMember',
            entityId: memberId,
            details: { amount: amount.toFixed(2) },
            at: ctx.at,
          },
          tx
        );
        return toRow(member);
      });
    } catch {
      const hardcoded = GORDON_COLLEGE_STUDENTS.find((m) => m.id === memberId);
      if (hardcoded) {
        hardcoded.chargeBalance = Math.max(0, hardcoded.chargeBalance - num(amount));
        return toHardcodedMemberRow(hardcoded);
      }
      throw new Error('Member not found.');
    }
  }
}
