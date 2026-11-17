// src/services/context.ts
import type { Prisma } from '@prisma/client';

/** Who is acting, and for which cooperative. Every service call takes one. */
export interface Ctx {
  branchId: number;
  userId: string | null;
  /** Backdates the records written. Used by the seed and tests only. */
  at?: Date;
}

export type Tx = Prisma.TransactionClient;
