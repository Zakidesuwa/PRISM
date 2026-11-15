// src/services/memberService.ts
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { AuditService } from './auditService';

export interface CreateMemberInput {
  memberCode: string;
  fullName: string;
  email?: string;
  phone?: string;
  branchId: number;
  shareCapital?: number | string | Prisma.Decimal;
}

export interface UpdateMemberInput {
  fullName?: string;
  email?: string;
  phone?: string;
  branchId?: number;
  status?: string;
  shareCapital?: number | string | Prisma.Decimal;
}

export class MemberService {
  /**
   * Retrieves all cooperative members with optional filtering by school branch and search keyword.
   */
  static async getAllMembers(params?: { branchId?: number; search?: string }) {
    const where: Prisma.CoopMemberWhereInput = {};

    if (params?.branchId) {
      where.branchId = params.branchId;
    }

    if (params?.search && params.search.trim() !== '') {
      const q = params.search.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { memberCode: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    return await prisma.coopMember.findMany({
      where,
      include: {
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves a member by ID.
   */
  static async getMemberById(id: number) {
    return await prisma.coopMember.findUnique({
      where: { id },
      include: {
        branch: true,
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Retrieves a member by member code (used for fast lookup in POS).
   */
  static async getMemberByCode(memberCode: string) {
    return await prisma.coopMember.findUnique({
      where: { memberCode },
      include: {
        branch: true,
      },
    });
  }

  /**
   * Registers a new cooperative member.
   */
  static async createMember(data: CreateMemberInput, actorUserId?: string) {
    const shareCapital = data.shareCapital
      ? new Prisma.Decimal(data.shareCapital.toString())
      : new Prisma.Decimal('0.00');

    const member = await prisma.coopMember.create({
      data: {
        memberCode: data.memberCode,
        fullName: data.fullName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        branchId: data.branchId,
        shareCapital,
        accumulatedPatronage: new Prisma.Decimal('0.00'),
        status: 'ACTIVE',
      },
      include: {
        branch: true,
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'MEMBER_CREATE',
      entityType: 'CoopMember',
      entityId: member.id,
      details: { memberCode: member.memberCode, branch: member.branch.name },
    });

    return member;
  }

  /**
   * Updates an existing member profile.
   */
  static async updateMember(id: number, data: UpdateMemberInput, actorUserId?: string) {
    const updateData: Prisma.CoopMemberUpdateInput = {};

    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.branchId !== undefined) {
      updateData.branch = { connect: { id: data.branchId } };
    }
    if (data.shareCapital !== undefined) {
      updateData.shareCapital = new Prisma.Decimal(data.shareCapital.toString());
    }

    const member = await prisma.coopMember.update({
      where: { id },
      data: updateData,
      include: { branch: true },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'MEMBER_UPDATE',
      entityType: 'CoopMember',
      entityId: member.id,
      details: data,
    });

    return member;
  }

  /**
   * Retrieves all school branches (cooperatives) for dropdown selection.
   */
  static async getAllBranches() {
    return await prisma.schoolBranch.findMany({
      orderBy: { name: 'asc' },
    });
  }
}
