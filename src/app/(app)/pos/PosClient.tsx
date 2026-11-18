'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  CircleCheck,
  CupSoda,
  IdCard,
  Minus,
  Package,
  PenTool,
  Plus,
  ReceiptText,
  ScanBarcode,
  ShoppingBasket,
  Smartphone,
  Trash2,
  UserRound,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react';
import styles from './page.module.css';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import EmptyState from '@/components/EmptyState/EmptyState';
import { useAction } from '@/lib/useAction';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatManilaDateTime, formatManilaTime } from '@/utils/formatters';
import { checkoutAction, searchMembersAction, voidTransactionAction } from '@/actions/posActions';
import { searchHardcodedMembers } from '@/lib/hardcodedMembers';
import type { ProductRow } from '@/services/productService';
import type { MemberRow } from '@/services/memberService';
import type { PaymentMethod, Receipt } from '@/services/transactionService';

interface Props {
  products: ProductRow[];
  todaysSales: Receipt[];
  taxRate: number;
  storeName: string;
  receiptHeader: string;
  receiptFooter: string;
  autoPrint: boolean;
  canVoid: boolean;
}

const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', GCASH: 'GCash', CHARGE: 'Charge to member' };
const METHOD_ICON: Record<PaymentMethod, LucideIcon> = { CASH: Banknote, GCASH: Smartphone, CHARGE: UserRound };

/** A recognisable icon per category, so products are found by shape as well as by name. */
function categoryIcon(category: string): LucideIcon {
  const name = category.toLowerCase();
  if (name.includes('bever') || name.includes('drink')) return CupSoda;
  if (name.includes('suppl') || name.includes('station')) return PenTool;
  if (name.includes('meal') || name.includes('food') || name.includes('snack')) return Utensils;
  return Package;
}

/** Bills a customer is likely to hand over: the next round amounts above the total. */
function suggestedBills(total: number): number[] {
  const bills = [20, 50, 100, 200, 500, 1000];
  const options = new Set<number>();
  for (const bill of bills) {
    const amount = Math.ceil(total / bill) * bill;
    if (amount > total && amount <= total + 1000) options.add(amount);
  }
  return [...options].sort((a, b) => a - b).slice(0, 4);
}
const round2 = (value: number) => Math.round(value * 100) / 100;

function ReceiptView({ receipt, storeName, header, footer }: { receipt: Receipt; storeName: string; header: string; footer: string }) {
  return (
    <div className="print-area" style={{ fontSize: 13, color: '#374151' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: '#111827' }}>{storeName}</div>
        {header && <div style={{ fontSize: 11 }}>{header}</div>}
        <div style={{ fontSize: 11, marginTop: 4 }}>
          {receipt.transactionNumber} · {formatManilaDateTime(receipt.createdAt)}
        </div>
        <div style={{ fontSize: 11 }}>Cashier: {receipt.cashierName}</div>
        {receipt.memberName && (
          <div style={{ fontSize: 11 }}>
            Member: {receipt.memberName} ({receipt.memberCode})
          </div>
        )}
        {receipt.status === 'VOIDED' && (
          <div style={{ fontWeight: 700, color: '#B91C1C', marginTop: 4 }}>VOIDED — {receipt.voidReason}</div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #D1D5DB', borderBottom: '1px dashed #D1D5DB', padding: '8px 0' }}>
        {receipt.items.map((item, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span>
              {item.quantity} x {item.name}
            </span>
            <span>{formatCurrency(item.subtotal)}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 0' }}>
        {[
          ['Subtotal', receipt.subtotal],
          ['Tax', receipt.taxAmount],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
            <span>{label}</span>
            <span>{formatCurrency(value as number)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#111827', fontSize: 15, marginTop: 4 }}>
          <span>Total</span>
          <span>{formatCurrency(receipt.totalAmount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span>Paid by</span>
          <span>{METHOD_LABEL[receipt.paymentMethod] ?? receipt.paymentMethod}</span>
        </div>
        {receipt.amountTendered !== null && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cash received</span>
              <span>{formatCurrency(receipt.amountTendered)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Change</span>
              <span>{formatCurrency(receipt.changeAmount ?? 0)}</span>
            </div>
          </>
        )}
        {receipt.paymentReference && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Reference</span>
            <span>{receipt.paymentReference}</span>
          </div>
        )}
      </div>

      {footer && <div style={{ textAlign: 'center', fontSize: 11 }}>{footer}</div>}
    </div>
  );
}

export default function PosClient(props: Props) {
  const { products, todaysSales, taxRate, canVoid } = props;
  const { run, pending } = useAction();
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState('All Items');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<number, number>>({});

  const [member, setMember] = useState<MemberRow | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<MemberRow[] | null>(null);

  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [showSales, setShowSales] = useState(false);
  const [voiding, setVoiding] = useState<Receipt | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const memberRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => ['All Items', ...Array.from(new Set(products.map((product) => product.category)))],
    [products]
  );
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const visible = products.filter((product) => {
    const q = search.trim().toLowerCase();
    if (q && !product.name.toLowerCase().includes(q) && !product.sku.toLowerCase().includes(q)) return false;
    return activeCategory === 'All Items' || product.category === activeCategory;
  });

  // Lines for products that still exist; a refresh can retire a product mid-order.
  const lines = Object.entries(cart)
    .map(([id, quantity]) => ({ product: productById.get(Number(id)), quantity }))
    .filter((line): line is { product: ProductRow; quantity: number } => Boolean(line.product));

  const subtotal = round2(lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0));
  const tax = round2(subtotal * (taxRate / 100));
  const total = round2(subtotal + tax);
  const tenderedAmount = Number(tendered);
  const change = round2(tenderedAmount - total);

  const maxFor = (product: ProductRow) => (product.available === null ? Infinity : product.available);

  function setQuantity(product: ProductRow, quantity: number) {
    if (quantity > maxFor(product)) {
      toast.warning(`Only ${product.available} of ${product.name} in stock.`);
      return;
    }
    setCart((previous) => {
      const next = { ...previous };
      if (quantity <= 0) delete next[product.id];
      else next[product.id] = quantity;
      return next;
    });
  }

  function findMember(event: React.FormEvent) {
    event.preventDefault();
    const q = memberQuery.trim();
    if (!q) return;

    const localMatches = searchHardcodedMembers(q);
    if (localMatches.length === 1) {
      setMember(localMatches[0]);
      setMemberResults(null);
      setMemberQuery('');
      return;
    }

    if (localMatches.length > 1) {
      setMemberResults(localMatches);
    }

    run(
      () => searchMembersAction(q),
      (found) => {
        const combined = [...localMatches];
        const seen = new Set(combined.map((m) => m.memberCode));
        for (const item of found) {
          if (!seen.has(item.memberCode)) combined.push(item);
        }
        if (combined.length === 1) {
          setMember(combined[0]);
          setMemberResults(null);
          setMemberQuery('');
        } else {
          setMemberResults(combined);
        }
      }
    );
  }

  function openPayment() {
    setMethod('CASH');
    setTendered('');
    setReference('');
    setPaying(true);
  }

  function pay() {
    run(
      () =>
        checkoutAction({
          items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
          memberId: member?.id ?? null,
          paymentMethod: method,
          amountTendered: method === 'CASH' ? tendered : undefined,
          paymentReference: method === 'GCASH' ? reference : undefined,
        }),
      (result) => {
        setPaying(false);
        setCart({});
        setMember(null);
        setReceipt(result);
      }
    );
  }

  function confirmVoid() {
    if (!voiding) return;
    run(
      () => voidTransactionAction(voiding.id, voidReason),
      () => {
        setVoiding(null);
        setVoidReason('');
      }
    );
  }

  // Keyboard shortcuts for a busy till: / or F2 search, F4 member, F9 pay.
  const modalOpen = paying || Boolean(receipt) || showSales || Boolean(voiding);
  const canOpenPayment = lines.length > 0;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (modalOpen) return;
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === 'F2' || (event.key === '/' && !typing)) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === 'F4') {
        event.preventDefault();
        memberRef.current?.focus();
      } else if (event.key === 'F9' && canOpenPayment) {
        event.preventDefault();
        openPayment();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, canOpenPayment]);

  // "Clear" needs a second tap within a few seconds, so a stray tap never wipes an order.
  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  /** Enter in the search box: a barcode scan or an exact SKU adds that product straight away. */
  function addFromSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exact = products.find((product) => product.sku.toLowerCase() === q);
    const match = exact ?? (visible.length === 1 ? visible[0] : null);
    if (!match) {
      toast.info(visible.length === 0 ? 'No product matches that search.' : 'Several products match. Tap the one you want.');
      return;
    }
    if (match.available === 0) {
      toast.warning(`${match.name} is out of stock.`);
      return;
    }
    setQuantity(match, (cart[match.id] ?? 0) + 1);
    setSearch('');
  }

  const justPaid = receipt?.status === 'COMPLETED';
  useEffect(() => {
    if (props.autoPrint && justPaid) window.print();
  }, [props.autoPrint, justPaid, receipt?.id]);

  const canPay =
    method === 'CASH'
      ? tendered !== '' && tenderedAmount >= total
      : method === 'GCASH'
        ? reference.trim() !== ''
        : member !== null && member.availableCredit >= total;

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 className={styles.title}>Point of Sales</h1>
        <div className={ui.row}>
          <form onSubmit={addFromSearch} className={styles.searchBox}>
            <ScanBarcode size={18} aria-hidden="true" className={styles.searchIcon} />
            <input
              ref={searchRef}
              className={ui.input}
              style={{ paddingLeft: 38, paddingRight: 40, width: 300 }}
              placeholder="Search or scan barcode, then Enter"
              aria-label="Search products or scan a barcode"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className={`${ui.kbd} ${styles.searchKbd}`} aria-hidden="true">
              /
            </span>
          </form>
          <button type="button" className={ui.btn} onClick={() => setShowSales(true)}>
            <ReceiptText size={16} aria-hidden="true" />
            Today&apos;s sales ({todaysSales.length})
          </button>
        </div>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.leftPanel}>
          <div className={styles.categoryTabs}>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`${styles.tab} ${activeCategory === category ? styles.tabActive : ''}`}
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className={styles.productGrid}>
            {visible.map((product) => {
              const soldOut = product.available === 0;
              const inCart = cart[product.id] ?? 0;
              const lowStock = product.available !== null && product.available > 0 && product.available <= 5;
              const Icon = categoryIcon(product.category);
              return (
                <button
                  type="button"
                  key={product.id}
                  disabled={soldOut}
                  onClick={() => setQuantity(product, inCart + 1)}
                  className={`${styles.productCard} ${soldOut ? styles.productCardDisabled : ''} ${inCart ? styles.productCardInCart : ''}`}
                  aria-label={`Add ${product.name}, ${formatCurrency(product.price)}${soldOut ? ', out of stock' : ''}`}
                >
                  {soldOut && <div className={styles.outOfStockBadge}>OUT OF STOCK</div>}
                  {inCart > 0 && (
                    <span className={styles.inCartBadge} aria-label={`${inCart} in cart`}>
                      {inCart}
                    </span>
                  )}
                  <div className={styles.imageArea}>
                    <Icon size={24} color="#2563EB" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className={styles.productInfo}>
                    <span className={styles.productName}>{product.name}</span>
                    <span className={styles.productPrice}>{formatCurrency(product.price)}</span>
                    {product.available !== null && !soldOut && (
                      <span className={lowStock ? styles.stockLow : ui.muted}>{product.available} left</span>
                    )}
                  </div>
                </button>
              );
            })}
            {visible.length === 0 && (
              <EmptyState
                icon={ScanBarcode}
                title="No products match"
                hint={search ? `Nothing found for "${search}".` : 'This category has no products on sale.'}
                action={
                  search ? (
                    <button type="button" className={ui.btn} onClick={() => setSearch('')}>
                      Clear search
                    </button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.orderHeader}>
            <div>
              <h2 className={styles.orderTitle}>Current Order</h2>
              <span className={styles.orderNumber}>
                {lines.reduce((sum, line) => sum + line.quantity, 0)} items
              </span>
            </div>
            {lines.length > 0 && (
              <button
                type="button"
                className={`${styles.clearBtn} ${confirmClear ? styles.clearBtnConfirm : ''}`}
                onClick={() => {
                  if (confirmClear) {
                    setCart({});
                    setConfirmClear(false);
                  } else {
                    setConfirmClear(true);
                  }
                }}
                aria-label={confirmClear ? 'Tap again to clear the order' : 'Clear order'}
              >
                <Trash2 size={16} aria-hidden="true" />
                {confirmClear ? 'Tap again to clear' : 'Clear'}
              </button>
            )}
          </div>

          {/* Member: scan the ID or type a name */}
          <div style={{ padding: '0 16px 12px' }}>
            {member ? (
              <div className={ui.notice} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <IdCard size={20} aria-hidden="true" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{member.fullName}</div>
                  <div style={{ fontSize: 12 }}>
                    {member.memberCode} · credit left {formatCurrency(member.availableCredit)}
                  </div>
                </div>
                <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => setMember(null)} aria-label="Remove member from order">
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <form onSubmit={findMember} className={ui.row} style={{ flexWrap: 'nowrap' }}>
                <input
                  ref={memberRef}
                  className={ui.input}
                  aria-label="Member ID or name (F4)"
                  placeholder="Member ID or name (F4)"
                  value={memberQuery}
                  onChange={(event) => {
                    setMemberQuery(event.target.value);
                    setMemberResults(null);
                  }}
                />
                <button type="submit" className={ui.btn} disabled={pending}>
                  Find
                </button>
              </form>
            )}
            {memberResults && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {memberResults.length === 0 && <span className={ui.muted}>No member found.</span>}
                {memberResults.map((found) => (
                  <button
                    key={found.id}
                    type="button"
                    className={ui.btn}
                    style={{ justifyContent: 'space-between' }}
                    disabled={found.status !== 'ACTIVE'}
                    onClick={() => {
                      setMember(found);
                      setMemberResults(null);
                      setMemberQuery('');
                    }}
                  >
                    <span>{found.fullName}</span>
                    <span className={ui.muted}>
                      {found.memberCode}
                      {found.status !== 'ACTIVE' ? ' · inactive' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.orderItems}>
            {lines.length === 0 ? (
              <EmptyState
                icon={ShoppingBasket}
                title="No items yet"
                hint="Tap a product, or scan a barcode into the search box."
              />
            ) : (
              lines.map(({ product, quantity }) => (
                <div key={product.id} className={styles.orderItem}>
                  <div className={styles.itemDetails}>
                    <div className={styles.itemName}>{product.name}</div>
                    <div className={styles.itemUnitPrice}>{formatCurrency(product.price)} / unit</div>
                  </div>
                  <div className={styles.itemControls}>
                    <div className={styles.quantityControls}>
                      <button
                        type="button"
                        className={styles.qtyButton}
                        onClick={() => setQuantity(product, quantity - 1)}
                        aria-label={quantity === 1 ? `Remove ${product.name}` : `One less ${product.name}`}
                      >
                        {quantity === 1 ? <Trash2 size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
                      </button>
                      <span aria-live="polite">{quantity}</span>
                      <button
                        type="button"
                        className={styles.qtyButton}
                        onClick={() => setQuantity(product, quantity + 1)}
                        aria-label={`One more ${product.name}`}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <div className={styles.itemTotal}>{formatCurrency(product.price * quantity)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.orderSummary}>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Tax ({taxRate}%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <button
              type="button"
              className={styles.payButton}
              onClick={openPayment}
              disabled={lines.length === 0}
              style={{ opacity: lines.length === 0 ? 0.5 : 1, cursor: lines.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              <span>PAY {formatCurrency(total)}</span>
              <span className={styles.payKbd} aria-hidden="true">
                F9
              </span>
            </button>
          </div>
        </div>
      </main>

      {paying && (
        <Modal title={`Payment — ${formatCurrency(total)}`} onClose={() => setPaying(false)}>
          <div className={ui.tabs} style={{ marginBottom: 16 }}>
            {(['CASH', 'GCASH', 'CHARGE'] as PaymentMethod[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`${ui.tab} ${method === option ? ui.tabActive : ''}`}
                aria-pressed={method === option}
                onClick={() => setMethod(option)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {React.createElement(METHOD_ICON[option], { size: 16, 'aria-hidden': true })}
                {METHOD_LABEL[option]}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (canPay && !pending) pay();
            }}
          >
          {method === 'CASH' && (
            <>
              <label className={ui.field}>
                <span className={ui.label}>Cash received (₱)</span>
                <input
                  className={ui.input}
                  style={{ fontSize: '1.25rem', fontWeight: 600, minHeight: 52 }}
                  inputMode="decimal"
                  autoFocus
                  value={tendered}
                  onChange={(event) => setTendered(event.target.value)}
                />
              </label>
              <div className={ui.row} style={{ marginTop: 8 }}>
                <button type="button" className={`${ui.btn} ${ui.btnSmall}`} onClick={() => setTendered(total.toFixed(2))}>
                  Exact
                </button>
                {suggestedBills(total).map((bill) => (
                  <button key={bill} type="button" className={ui.btn} onClick={() => setTendered(String(bill))}>
                    ₱{bill.toLocaleString('en-PH')}
                  </button>
                ))}
              </div>
              <div
                className={`${styles.changeBox} ${tendered !== '' && change < 0 ? styles.changeBoxShort : tendered !== '' ? styles.changeBoxOk : ''}`}
                aria-live="polite"
              >
                <span className={styles.changeLabel}>{tendered !== '' && change < 0 ? 'Still short' : 'Change to give'}</span>
                <span className={styles.changeValue}>
                  {tendered === '' ? '—' : formatCurrency(Math.abs(change))}
                </span>
              </div>
            </>
          )}

          {method === 'GCASH' && (
            <label className={ui.field}>
              <span className={ui.label}>GCash reference number</span>
              <input className={ui.input} autoFocus value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
          )}

          {method === 'CHARGE' &&
            (member ? (
              <div className={member.availableCredit >= total ? ui.notice : ui.error}>
                Charge to <strong>{member.fullName}</strong>. Credit left: {formatCurrency(member.availableCredit)} of{' '}
                {formatCurrency(member.creditLimit)}.
                {member.availableCredit < total && ' Not enough credit for this sale.'}
              </div>
            ) : (
              <div className={ui.warning}>Add a member to the order first, then charge the sale to their account.</div>
            ))}

          <div className={ui.modalActions}>
            <button type="button" className={ui.btn} onClick={() => setPaying(false)}>
              Cancel
            </button>
            <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} disabled={!canPay || pending} style={{ minWidth: 160 }}>
              {pending ? 'Processing…' : (
                <>
                  <CircleCheck size={16} aria-hidden="true" />
                  Complete sale
                </>
              )}
            </button>
          </div>
          </form>
        </Modal>
      )}

      {receipt && (
        <Modal title={receipt.status === 'VOIDED' ? 'Voided sale' : 'Payment successful'} onClose={() => setReceipt(null)}>
          {justPaid && receipt.changeAmount !== null && receipt.changeAmount > 0 && (
            <div className={`${styles.changeBox} ${styles.changeBoxOk} ${ui.noPrint}`} style={{ marginBottom: 16 }}>
              <span className={styles.changeLabel}>Give change</span>
              <span className={styles.changeValue}>{formatCurrency(receipt.changeAmount)}</span>
            </div>
          )}
          <ReceiptView receipt={receipt} storeName={props.storeName} header={props.receiptHeader} footer={props.receiptFooter} />
          <div className={`${ui.modalActions} ${ui.noPrint}`}>
            <button type="button" className={ui.btn} onClick={() => window.print()}>
              Print receipt
            </button>
            <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => setReceipt(null)}>
              {justPaid ? 'New order' : 'Close'}
            </button>
          </div>
        </Modal>
      )}

      {showSales && (
        <Modal title="Today's sales" wide onClose={() => setShowSales(false)}>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Sale</th>
                  <th>Time</th>
                  <th>Paid by</th>
                  <th className={ui.num}>Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {todaysSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className={ui.strong}>{sale.transactionNumber}</td>
                    <td>{formatManilaTime(sale.createdAt)}</td>
                    <td>{METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</td>
                    <td className={ui.num}>{formatCurrency(sale.totalAmount)}</td>
                    <td>
                      <span className={`${ui.badge} ${sale.status === 'COMPLETED' ? ui.badgeGreen : ui.badgeRed}`}>
                        {sale.status === 'COMPLETED' ? 'Completed' : 'Voided'}
                      </span>
                    </td>
                    <td>
                      <div className={ui.row} style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button
                          type="button"
                          className={`${ui.btn} ${ui.btnSmall}`}
                          onClick={() => {
                            setShowSales(false);
                            setReceipt(sale);
                          }}
                        >
                          Receipt
                        </button>
                        {canVoid && sale.status === 'COMPLETED' && (
                          <button
                            type="button"
                            className={`${ui.btn} ${ui.btnSmall} ${ui.btnDanger}`}
                            onClick={() => {
                              setShowSales(false);
                              setVoiding(sale);
                            }}
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {todaysSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className={ui.empty}>
                      No sales yet today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!canVoid && <p className={ui.muted} style={{ marginTop: 8 }}>Only a manager can void a sale.</p>}
          <div className={ui.modalActions}>
            <button type="button" className={ui.btn} onClick={() => setShowSales(false)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {voiding && (
        <Modal
          title={`Void sale ${voiding.transactionNumber}`}
          hint={`${formatCurrency(voiding.totalAmount)} will be reversed and the stock put back.`}
          onClose={() => setVoiding(null)}
        >
          <label className={ui.field}>
            <span className={ui.label}>Reason</span>
            <input className={ui.input} autoFocus value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
          </label>
          <div className={ui.modalActions}>
            <button type="button" className={ui.btn} onClick={() => setVoiding(null)}>
              Keep sale
            </button>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnDanger}`}
              disabled={!voidReason.trim() || pending}
              onClick={confirmVoid}
            >
              Void sale
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
