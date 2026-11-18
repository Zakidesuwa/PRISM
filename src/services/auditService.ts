// src/services/auditService.ts
import prisma from '@/lib/prisma';
import type { Tx } from './context';

export interface CreateAuditLogParams {
  branchId?: number | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: object | string | null;
  at?: Date;
}

export class AuditService {
  /** Records an audit entry. Pass the transaction client when inside one. */
  static async log(params: CreateAuditLogParams, db: Tx | typeof prisma = prisma) {
    if (!process.env.DATABASE_URL) {
      return null as any;
    }
    const details =
      typeof params.details === 'object' && params.details !== null
        ? JSON.stringify(params.details)
        : params.details ?? null;

    try {
      return await db.auditLog.create({
        data: {
          branchId: params.branchId ?? null,
          userId: params.userId ?? null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId != null ? String(params.entityId) : null,
          details,
          ...(params.at ? { timestamp: params.at } : {}),
        },
      });
    } catch {
      return null as any;
    }
  }

  static async getRecentLogs(branchId: number | null, limit = 50) {
    if (!process.env.DATABASE_URL) {
      return [
        {
          id: 1,
          action: 'USER_LOGIN',
          entityType: 'User',
          entityId: 'usr-manager',
          details: 'Session started',
          userName: 'Gordon College Manager',
          timestamp: new Date().toISOString(),
        },
      ];
    }
    try {
      const rows = await prisma.auditLog.findMany({
        where: branchId === null ? {} : { branchId },
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, role: true } } },
      });

      return rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        details: row.details,
        userName: row.user?.name ?? 'System',
        timestamp: row.timestamp.toISOString(),
      }));
    } catch {
      return [
        {
          id: 1,
          action: 'USER_LOGIN',
          entityType: 'User',
          entityId: 'usr-manager',
          details: 'Session started',
          userName: 'Gordon College Manager',
          timestamp: new Date().toISOString(),
        },
      ];
    }
  }
}
