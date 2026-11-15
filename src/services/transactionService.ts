// src/services/transactionService.ts
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { AuditService } from './auditService';

export interface CheckoutCartItem {
  productId: number;
  quantity: number;
}

export interface ProcessCheckoutInput {
  cashierId: string;
  memberId?: number | null;
  items: CheckoutCartItem[];
}

export interface CheckoutResult {
  transactionId: string;
  transactionNumber: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  itemCount: number;
  memberPatronageCredited?: string;
  createdAt: Date;
}

export class TransactionService {
  /**
   * Generates a unique transaction number (e.g. #1049).
   */
  private static async generateTransactionNumber(tx: Prisma.TransactionClient): Promise<string> {
    const count = await tx.transaction.count();
    const nextSeq = 1001 + count;
    return `#${nextSeq}`;
  }

  /**
   * Atomically processes a POS checkout transaction (ACID via prisma.$transaction).
   */
  static async processCheckout(input: ProcessCheckoutInput): Promise<CheckoutResult> {
    const { cashierId, memberId, items } = input;

    if (!items || items.length === 0) {
      throw new Error('Cart is empty. Please add items to checkout.');
    }

    // Execute everything in a single atomic database transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Verify Cashier
      const cashier = await tx.user.findUnique({
        where: { id: cashierId },
      });
      if (!cashier) {
        throw new Error(`Cashier with ID '${cashierId}' was not found.`);
      }

      // 2. Fetch and lock products
      const productIds = items.map((i) => i.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: {
          ingredients: {
            include: {
              inventoryItem: true,
            },
          },
        },
      });

      if (dbProducts.length !== productIds.length) {
        throw new Error('One or more products in your cart do not exist.');
      }

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      // 3. Validate product stock and compute recipe ingredient requirements
      let subtotalAcc = new Prisma.Decimal('0.00');
      const transactionItemsData: {
        productId: number;
        quantity: number;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
      }[] = [];

      // Map of inventoryItemId -> aggregated quantity required (Decimal)
      const rawIngredientNeeds = new Map<number, { item: typeof dbProducts[0]['ingredients'][0]['inventoryItem']; totalQty: Prisma.Decimal }>();

      for (const cartItem of items) {
        if (cartItem.quantity <= 0) {
          throw new Error('Quantity must be greater than zero.');
        }

        const product = productMap.get(cartItem.productId)!;

        // Check product stock
        if (product.stock < cartItem.quantity) {
          throw new Error(
            `Insufficient stock for product '${product.name}'. Available: ${product.stock}, Requested: ${cartItem.quantity}`
          );
        }

        // Calculate item subtotal
        const itemQtyDec = new Prisma.Decimal(cartItem.quantity);
        const itemSubtotal = product.price.mul(itemQtyDec);
        subtotalAcc = subtotalAcc.add(itemSubtotal);

        transactionItemsData.push({
          productId: product.id,
          quantity: cartItem.quantity,
          unitPrice: product.price,
          subtotal: itemSubtotal,
        });

        // Accumulate recipe ingredients
        for (const recipe of product.ingredients) {
          const invId = recipe.inventoryItemId;
          const neededPerUnit = recipe.quantityRequired;
          const totalNeeded = neededPerUnit.mul(itemQtyDec);

          const existing = rawIngredientNeeds.get(invId);
          if (existing) {
            existing.totalQty = existing.totalQty.add(totalNeeded);
          } else {
            rawIngredientNeeds.set(invId, {
              item: recipe.inventoryItem,
              totalQty: totalNeeded,
            });
          }
        }
      }

      // 4. Validate and deduct raw inventory items
      for (const [invId, need] of rawIngredientNeeds.entries()) {
        const invItem = await tx.inventoryItem.findUnique({
          where: { id: invId },
        });

        if (!invItem) {
          throw new Error(`Raw material '${need.item.name}' was not found in inventory.`);
        }

        if (invItem.stock.lessThan(need.totalQty)) {
          throw new Error(
            `Insufficient raw inventory for '${invItem.name}'. Available: ${invItem.stock.toFixed(3)} ${invItem.unit}, Needed for order: ${need.totalQty.toFixed(3)} ${invItem.unit}`
          );
        }

        const newStock = invItem.stock.sub(need.totalQty);
        let newStatus = invItem.status;
        if (newStock.isZero()) {
          newStatus = 'Empty';
        } else if (newStock.lessThanOrEqualTo(new Prisma.Decimal('5.000'))) {
          newStatus = 'Low Stock';
        }

        await tx.inventoryItem.update({
          where: { id: invId },
          data: {
            stock: newStock,
            status: newStatus,
          },
        });
      }

      // 5. Deduct product finished goods stock
      for (const cartItem of items) {
        await tx.product.update({
          where: { id: cartItem.productId },
          data: {
            stock: {
              decrement: cartItem.quantity,
            },
          },
        });
      }

      // 6. Compute 5% Tax and Total Amount
      // 5% tax = subtotal * 0.05
      const taxRate = new Prisma.Decimal('0.05');
      const taxAmount = subtotalAcc.mul(taxRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const totalAmount = subtotalAcc.add(taxAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      // 7. Verify and credit Coop Member (if attached)
      let creditedMemberPatronage: Prisma.Decimal | undefined;
      if (memberId) {
        const member = await tx.coopMember.findUnique({
          where: { id: memberId },
        });

        if (!member) {
          throw new Error(`Coop Member with ID '${memberId}' does not exist.`);
        }

        if (member.status !== 'ACTIVE') {
          throw new Error(`Coop Member '${member.fullName}' is not active.`);
        }

        // Credit member accumulated patronage with total transaction amount
        const updatedMember = await tx.coopMember.update({
          where: { id: memberId },
          data: {
            accumulatedPatronage: {
              increment: totalAmount,
            },
          },
        });

        creditedMemberPatronage = updatedMember.accumulatedPatronage;
      }

      // 8. Create Transaction and Transaction Items
      const transactionNumber = await this.generateTransactionNumber(tx);

      const createdTx = await tx.transaction.create({
        data: {
          transactionNumber,
          cashierId,
          memberId: memberId ?? null,
          subtotal: subtotalAcc.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          taxAmount,
          totalAmount,
          paymentMethod: 'CASH', // Cash only enforced
          status: 'COMPLETED',
          items: {
            create: transactionItemsData.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
            })),
          },
        },
      });

      // 9. Write to AuditLog
      await AuditService.log(
        {
          userId: cashierId,
          action: 'POS_CHECKOUT',
          entityType: 'Transaction',
          entityId: createdTx.id,
          details: {
            transactionNumber,
            totalAmount: totalAmount.toString(),
            itemCount: items.length,
            memberId: memberId ?? null,
            paymentMethod: 'CASH',
          },
        },
        tx
      );

      return {
        transactionId: createdTx.id,
        transactionNumber: createdTx.transactionNumber,
        subtotal: subtotalAcc.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        itemCount: items.reduce((acc, i) => acc + i.quantity, 0),
        memberPatronageCredited: creditedMemberPatronage?.toFixed(2),
        createdAt: createdTx.createdAt,
      };
    });
  }

  /**
   * Retrieves recent transactions for dashboard / analytics.
   */
  static async getRecentTransactions(limit = 10) {
    return await prisma.transaction.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        cashier: { select: { name: true, username: true } },
        member: { select: { fullName: true, memberCode: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
    });
  }
}
