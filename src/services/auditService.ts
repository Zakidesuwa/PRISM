// src/services/auditService.ts
import prisma from '@/lib/prisma';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown> | object | string | null;
}

export class AuditService {
  /**
   * Records an audit log entry in the database.
   */
  static async log(params: CreateAuditLogParams, txClient?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
    const client = txClient ?? prisma;
    const detailsStr =
      typeof params.details === 'object' && params.details !== null
        ? JSON.stringify(params.details)
        : params.details?.toString() ?? null;

    return await client.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ? params.entityId.toString() : null,
        details: detailsStr,
      },
    });
  }

  /**
   * Retrieves recent audit logs for system tracking and analytics.
   */
  static async getRecentLogs(limit = 50) {
    return await prisma.auditLog.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }
}
