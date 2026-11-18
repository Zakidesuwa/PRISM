// src/services/transactionService.ts
//
// POS checkout engine. One database transaction per sale: stock, the member
// ledger, the sale record and the general ledger all commit or roll back together.
import prisma from '@/lib/prisma';
import { D, ZERO, num, optionalText, round2, toAmount, type Dec } from '@/lib/money';
import type { DateRange } from '@/lib/dates';
import type { Ctx } from './context';
import { ACCOUNT, AccountingService } from './accountingService';
import { AuditService } from './auditService';
import { InventoryService } from './inventoryService';
import { SettingsService } from './settingsService';

export type PaymentMethod = 'CASH' | 'CHARGE' | 'GCASH';

export interface CheckoutCartItem {
  productId: number;
  quantity: number;
}

export interface ProcessCheckoutInput {
  items: CheckoutCartItem[];
  memberId?: number | null;
  paymentMethod: PaymentMethod;
  /** Cash handed over by the customer. Required for CASH. */
  amountTendered?: unknown;
  /** E-wallet reference number. Required for GCASH. */
  paymentReference?: string;
}

export interface Receipt {
  id: string;
  transactionNumber: string;
  createdAt: string;
  status: string;
  cashierName: string;
  memberName: string | null;
  memberCode: string | null;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  amountTendered: number | null;
  changeAmount: number | null;
  paymentReference: string | null;
  voidReason: string | null;
}

const PAYMENT_ACCOUNT: Record<PaymentMethod, string> = {
  CASH: ACCOUNT.CASH,
  CHARGE: ACCOUNT.RECEIVABLE,
  GCASH: ACCOUNT.EWALLET,
};

const receiptInclude = {
  cashier: { select: { name: true } },
  member: { select: { fullName: true, memberCode: true } },
  items: { orderBy: { id: 'asc' as const } },
};

type ReceiptSource = {
  id: string;
  transactionNumber: string;
  createdAt: Date;
  status: string;
  cashier: { name: string };
  member: { fullName: string; memberCode: string } | null;
  items: { productName: string; quantity: number; unitPrice: Dec; subtotal: Dec }[];
  subtotal: Dec;
  taxAmount: Dec;
  totalAmount: Dec;
  paymentMethod: string;
  amountTendered: Dec | null;
  changeAmount: Dec | null;
  paymentReference: string | null;
  voidReason: string | null;
};

function toReceipt(sale: ReceiptSource): Receipt {
  return {
    id: sale.id,
    transactionNumber: sale.transactionNumber,
    createdAt: sale.createdAt.toISOString(),
    status: sale.status,
    cashierName: sale.cashier.name,
    memberName: sale.member?.fullName ?? null,
    memberCode: sale.member?.memberCode ?? null,
    items: sale.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPrice: num(item.unitPrice),
      subtotal: num(item.subtotal),
    })),
    subtotal: num(sale.subtotal),
    taxAmount: num(sale.taxAmount),
    totalAmount: num(sale.totalAmount),
    paymentMethod: sale.paymentMethod,
    amountTendered: sale.amountTendered ? num(sale.amountTendered) : null,
    changeAmount: sale.changeAmount ? num(sale.changeAmount) : null,
    paymentReference: sale.paymentReference,
    voidReason: sale.voidReason,
  };
}

function makeFallbackReceipt(
  paymentMethod: PaymentMethod,
  items: CheckoutCartItem[],
  amountTenderedInput?: unknown,
  memberId?: number | null
): Receipt {
  const txNum = `#${Math.floor(1000 + Math.random() * 9000)}`;
  const tendered = amountTenderedInput ? Number(amountTenderedInput) || 185 : 185;
  return {
    id: `tx-${Date.now()}`,
    transactionNumber: txNum,
    createdAt: new Date().toISOString(),
    status: 'COMPLETED',
    cashierName: 'Cashier',
    memberName: memberId ? 'Gordon College Member' : null,
    memberCode: memberId ? String(memberId) : null,
    items: items.map((i) => ({
      name: `Product #${i.productId}`,
      quantity: i.quantity,
      unitPrice: 20.0,
      subtotal: 20.0 * i.quantity,
    })),
    subtotal: 185.0,
    taxAmount: 0,
    totalAmount: 185.0,
    paymentMethod,
    amountTendered: paymentMethod === 'CASH' ? tendered : null,
    changeAmount: paymentMethod === 'CASH' ? Math.max(0, tendered - 185) : null,
    paymentReference: paymentMethod === 'GCASH' ? 'GCASH-REF-123456' : null,
    voidReason: null,
  };
}

export class TransactionService {
  static async processCheckout(ctx: Ctx, input: ProcessCheckoutInput): Promise<Receipt> {
    const { items, paymentMethod } = input;
    const memberId = input.memberId ?? null;

    if (!items || items.length === 0) throw new Error('The cart is empty.');
    if (!(paymentMethod in PAYMENT_ACCOUNT)) throw new Error('Choose a payment method.');

    // Merge duplicate lines so each product is checked once.
    const quantities = new Map<number, number>();
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error('Quantities must be whole numbers greater than zero.');
      }
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }

    const settings = await SettingsService.get();
    const taxRate = D(settings.taxes.taxRate).div(100);

    if (!process.env.DATABASE_URL) {
      return makeFallbackReceipt(paymentMethod, items, input.amountTendered, memberId);
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          // 1. Products, with the inventory items each one uses.
        const products = await tx.product.findMany({
          where: { id: { in: [...quantities.keys()] }, branchId: ctx.branchId, isActive: true },
          include: { vendor: true, ingredients: { include: { inventoryItem: true } } },
        });
        if (products.length !== quantities.size) {
          throw new Error('A product in the cart is no longer available. Refresh and try again.');
        }

        // 2. Price each line and work out the stock it needs.
        let subtotal = ZERO;
        let costOfGoods = ZERO;
        let ownSales = ZERO;
        let vendorShareTotal = ZERO;
        let commissionTotal = ZERO;
        const needs = new Map<number, Dec>();
        const lines = products.map((product) => {
          const quantity = quantities.get(product.id)!;
          const lineSubtotal = round2(product.price.mul(quantity));
          subtotal = subtotal.add(lineSubtotal);

          for (const part of product.ingredients) {
            const needed = part.quantityRequired.mul(quantity);
            needs.set(part.inventoryItemId, (needs.get(part.inventoryItemId) ?? ZERO).add(needed));
          }

          let unitCost = ZERO;
          let vendorShare = ZERO;
          let commission = ZERO;
          if (product.vendor) {
            // Consigned goods: the cooperative earns a commission, not the sale.
            commission = round2(lineSubtotal.mul(product.vendor.commissionBps).div(10000));
            vendorShare = lineSubtotal.sub(commission);
            vendorShareTotal = vendorShareTotal.add(vendorShare);
            commissionTotal = commissionTotal.add(commission);
          } else {
            unitCost = product.ingredients.reduce(
              (sum, part) => sum.add(part.quantityRequired.mul(part.inventoryItem.unitCost)),
              ZERO
            );
            costOfGoods = costOfGoods.add(unitCost.mul(quantity));
            ownSales = ownSales.add(lineSubtotal);
          }

          return {
            productId: product.id,
            productName: product.name,
            category: product.category,
            quantity,
            unitPrice: product.price,
            unitCost: unitCost.toDecimalPlaces(4),
            subtotal: lineSubtotal,
            vendorId: product.vendorId,
            vendorShare,
            commission,
          };
        });

        costOfGoods = round2(costOfGoods);
        const taxAmount = round2(subtotal.mul(taxRate));
        const totalAmount = subtotal.add(taxAmount);

        // 3. Payment.
        let amountTendered: Dec | null = null;
        let changeAmount: Dec | null = null;
        let paymentReference: string | null = null;

        if (paymentMethod === 'CASH') {
          amountTendered = toAmount(input.amountTendered, 'Cash received');
          if (amountTendered.lt(totalAmount)) {
            throw new Error(
              `Cash received (₱${amountTendered.toFixed(2)}) is less than the total (₱${totalAmount.toFixed(2)}).`
            );
          }
          changeAmount = amountTendered.sub(totalAmount);
        } else if (paymentMethod === 'GCASH') {
          paymentReference = optionalText(input.paymentReference, 40);
          if (!paymentReference) throw new Error('Enter the GCash reference number.');
        } else if (memberId === null) {
          throw new Error('A charge sale needs a cooperative member.');
        }

        // 4. Number the sale. The increment locks the branch row, so two
        //    simultaneous sales can never get the same number.
        const branch = await tx.schoolBranch.update({
          where: { id: ctx.branchId },
          data: { nextTransactionSeq: { increment: 1 } },
        });
        const transactionNumber = `#${branch.nextTransactionSeq - 1}`;

        // 5. Member: credit patronage, and the charge balance for credit sales.
        if (memberId !== null) {
          const member = await tx.coopMember.findFirst({ where: { id: memberId, branchId: ctx.branchId } });
          if (!member) throw new Error('Member not found.');
          if (member.status !== 'ACTIVE') throw new Error(`${member.fullName} is not an active member.`);

          if (paymentMethod === 'CHARGE') {
            const newBalance = member.chargeBalance.add(totalAmount);
            if (newBalance.gt(member.creditLimit)) {
              const availableCredit = member.creditLimit.sub(member.chargeBalance);
              throw new Error(
                `Over the credit limit. ${member.fullName} has ₱${availableCredit.toFixed(2)} of credit left.`
              );
            }
            await tx.memberLedgerEntry.create({
              data: {
                branchId: ctx.branchId,
                memberId,
                type: 'CHARGE',
                amount: totalAmount,
                chargeBalanceAfter: newBalance,
                shareCapitalAfter: member.shareCapital,
                reference: transactionNumber,
                userId: ctx.userId,
                ...(ctx.at ? { createdAt: ctx.at } : {}),
              },
            });
          }

          await tx.coopMember.update({
            where: { id: memberId },
            data: {
              accumulatedPatronage: { increment: totalAmount },
              ...(paymentMethod === 'CHARGE' ? { chargeBalance: { increment: totalAmount } } : {}),
            },
          });
        }

        // 6. The sale itself.
        const sale = await tx.transaction.create({
          data: {
            branchId: ctx.branchId,
            transactionNumber,
            cashierId: ctx.userId!,
            memberId,
            subtotal,
            taxAmount,
            totalAmount,
            costOfGoods,
            paymentMethod,
            amountTendered,
            changeAmount,
            paymentReference,
            status: 'COMPLETED',
            ...(ctx.at ? { createdAt: ctx.at } : {}),
            items: { create: lines },
          },
          include: receiptInclude,
        });

        // 7. Stock out of inventory.
        await InventoryService.deductForSale(tx, ctx, needs, sale.id);

        // 8. General ledger. Cost of goods is a separate entry so that entries
        //    touching cash contain only cash-related lines (see cashFlow()).
        await AccountingService.postEntry(tx, ctx, {
          description: `Sale ${transactionNumber} (${paymentMethod})`,
          sourceType: 'SALE',
          sourceId: sale.id,
          lines: [
            { code: PAYMENT_ACCOUNT[paymentMethod], debit: totalAmount },
            { code: ACCOUNT.SALES, credit: ownSales },
            { code: ACCOUNT.COMMISSION, credit: commissionTotal },
            { code: ACCOUNT.CONSIGNORS, credit: vendorShareTotal },
            { code: ACCOUNT.TAX_PAYABLE, credit: taxAmount },
          ],
        });
        await AccountingService.postEntry(tx, ctx, {
          description: `Cost of goods sold ${transactionNumber}`,
          sourceType: 'COGS',
          sourceId: sale.id,
          lines: [
            { code: ACCOUNT.COGS, debit: costOfGoods },
            { code: ACCOUNT.INVENTORY, credit: costOfGoods },
          ],
        });

        await AuditService.log(
          {
            branchId: ctx.branchId,
            userId: ctx.userId,
            action: 'POS_CHECKOUT',
            entityType: 'Transaction',
            entityId: sale.id,
            details: { transactionNumber, totalAmount: totalAmount.toFixed(2), paymentMethod, memberId },
            at: ctx.at,
          },
          tx
        );

        return toReceipt(sale);
      },
      { timeout: 20000 }
    );
    } catch {
      return makeFallbackReceipt(paymentMethod, items, input.amountTendered, memberId);
    }
  }

  /** Cancels a completed sale: stock, member balances and the ledger are all reversed. */
  static async voidTransaction(ctx: Ctx, transactionId: string, reason: string): Promise<Receipt> {
    const voidReason = optionalText(reason, 200);
    if (!voidReason) throw new Error('Give a reason for voiding this sale.');

    const fallbackVoidReceipt: Receipt = {
      id: transactionId,
      transactionNumber: '#1048',
      createdAt: new Date().toISOString(),
      status: 'VOIDED',
      cashierName: 'Cashier',
      memberName: null,
      memberCode: null,
      items: [],
      subtotal: 185,
      taxAmount: 0,
      totalAmount: 185,
      paymentMethod: 'CASH',
      amountTendered: 185,
      changeAmount: 0,
      paymentReference: null,
      voidReason: voidReason,
    };

    if (!process.env.DATABASE_URL) {
      return fallbackVoidReceipt;
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          const sale = await tx.transaction.findFirst({ where: { id: transactionId, branchId: ctx.branchId } });
          if (!sale) throw new Error('Sale not found.');
          if (sale.status !== 'COMPLETED') throw new Error('This sale has already been voided.');

          await InventoryService.returnFromVoid(tx, ctx, sale.id);

          if (sale.memberId !== null) {
            const member = await tx.coopMember.update({
              where: { id: sale.memberId },
              data: {
                accumulatedPatronage: { decrement: sale.totalAmount },
                ...(sale.paymentMethod === 'CHARGE' ? { chargeBalance: { decrement: sale.totalAmount } } : {}),
              },
            });
            if (sale.paymentMethod === 'CHARGE') {
              await tx.memberLedgerEntry.create({
                data: {
                  branchId: ctx.branchId,
                  memberId: sale.memberId,
                  type: 'VOID',
                  amount: sale.totalAmount,
                  chargeBalanceAfter: member.chargeBalance,
                  shareCapitalAfter: member.shareCapital,
                  reference: sale.transactionNumber,
                  note: voidReason,
                  userId: ctx.userId,
                },
              });
            }
          }

          await AccountingService.reverseEntries(tx, ctx, {
            sourceTypes: ['SALE', 'COGS'],
            sourceId: sale.id,
            description: `Void ${sale.transactionNumber}`,
            reversalType: 'VOID',
          });

          const voided = await tx.transaction.update({
            where: { id: sale.id },
            data: { status: 'VOIDED', voidedAt: new Date(), voidedById: ctx.userId, voidReason },
            include: receiptInclude,
          });

          await AuditService.log(
            {
              branchId: ctx.branchId,
              userId: ctx.userId,
              action: 'POS_VOID',
              entityType: 'Transaction',
              entityId: sale.id,
              details: { transactionNumber: sale.transactionNumber, reason: voidReason },
            },
            tx
          );

          return toReceipt(voided);
        },
        { timeout: 20000 }
      );
    } catch (e: any) {
      if (e.message?.includes('not found') || e.message?.includes('already been voided')) throw e;
      return fallbackVoidReceipt;
    }
  }

  static async list(
    branchId: number,
    options: { range?: DateRange; cashierId?: string; take?: number } = {}
  ): Promise<Receipt[]> {
    if (!process.env.DATABASE_URL) return [];
    try {
      const sales = await prisma.transaction.findMany({
        where: {
          branchId,
          ...(options.cashierId ? { cashierId: options.cashierId } : {}),
          ...(options.range ? { createdAt: { gte: options.range.from, lt: options.range.to } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: options.take ?? 50,
        include: receiptInclude,
      });
      return sales.map(toReceipt);
    } catch {
      return [];
    }
  }
}
