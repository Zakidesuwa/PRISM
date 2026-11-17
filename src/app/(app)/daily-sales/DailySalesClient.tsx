'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import { useAction } from '@/lib/useAction';
import { longDate } from '@/lib/dates';
import { formatCurrency, formatManilaTime } from '@/utils/formatters';
import { payVendorAction, reopenCashCountAction, saveVendorAction, submitCashCountAction } from '@/actions/salesActions';
import type { DrawerRow, SalesReading, VendorRow } from '@/services/salesService';
import type { Receipt } from '@/services/transactionService';

interface Props {
  date: string;
  today: string;
  tab: string;
  isManager: boolean;
  storeName: string;
  reading: SalesReading;
  drawers: DrawerRow[];
  sales: Receipt[];
  vendors: VendorRow[];
}

const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', GCASH: 'GCash', CHARGE: 'Charge to member' };

type Dialog =
  | { kind: 'count'; drawer: DrawerRow }
  | { kind: 'vendor'; vendor: VendorRow | null }
  | { kind: 'payout'; vendor: VendorRow }
  | null;

export default function DailySalesClient(props: Props) {
  const { date, reading, drawers, sales, vendors, isManager } = props;
  const router = useRouter();
  const { run, pending } = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);

  const [openingFloat, setOpeningFloat] = useState('1000');
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [vendorForm, setVendorForm] = useState({ name: '', contactPerson: '', phone: '', commissionPercent: '15' });
  const [amount, setAmount] = useState('');

  const close = () => setDialog(null);
  const go = (next: { date?: string; tab?: string }) =>
    router.push(`/daily-sales?date=${next.date ?? date}&tab=${next.tab ?? props.tab}`);

  const tabs = [
    { id: 'reading', label: 'Sales Reading' },
    { id: 'cash', label: 'Cash Over / Short' },
    ...(isManager ? [{ id: 'vendors', label: 'Vendor Split' }] : []),
  ];

  const expected = (drawer: DrawerRow, float: number) => float + drawer.cashSales + drawer.collections;
  const liveVariance =
    dialog?.kind === 'count' && countedCash !== ''
      ? Math.round((Number(countedCash) - expected(dialog.drawer, Number(openingFloat) || 0)) * 100) / 100
      : null;

  const varianceBadge = (variance: number) =>
    variance === 0 ? (
      <span className={`${ui.badge} ${ui.badgeGreen}`}>Exact</span>
    ) : variance > 0 ? (
      <span className={`${ui.badge} ${ui.badgeBlue}`}>Over {formatCurrency(variance)}</span>
    ) : (
      <span className={`${ui.badge} ${ui.badgeRed}`}>Short {formatCurrency(-variance)}</span>
    );

  return (
    <div className={ui.page}>
      <div className={`${ui.pageHeader} ${ui.noPrint}`}>
        <div>
          <h1 className={ui.title}>Daily Sales</h1>
          <p className={ui.subtitle}>
            {isManager ? 'Sales reading, cash counts and vendor split for the day.' : 'Your sales and cash drawer for the day.'}
          </p>
        </div>
        <div className={ui.row}>
          <input
            type="date"
            className={ui.input}
            style={{ width: 'auto' }}
            value={date}
            max={props.today}
            onChange={(event) => event.target.value && go({ date: event.target.value })}
            aria-label="Business date"
          />
          <button className={ui.btn} onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <div className={`${ui.tabs} ${ui.noPrint}`}>
        {tabs.map((tab) => (
          <button key={tab.id} className={`${ui.tab} ${props.tab === tab.id ? ui.tabActive : ''}`} onClick={() => go({ tab: tab.id })}>
            {tab.label}
          </button>
        ))}
      </div>

      {props.tab === 'reading' && (
        <div className="print-area" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className={ui.cardTitle}>
              {props.storeName} — Sales Reading
            </div>
            <div className={ui.muted}>{longDate(date)}</div>
          </div>

          <div className={ui.statGrid}>
            <div className={ui.stat}>
              <div className={ui.statLabel}>Gross sales</div>
              <div className={ui.statValue}>{formatCurrency(reading.grossSales)}</div>
              <div className={ui.statHint}>Before tax</div>
            </div>
            <div className={ui.stat}>
              <div className={ui.statLabel}>Tax collected</div>
              <div className={ui.statValue}>{formatCurrency(reading.taxCollected)}</div>
            </div>
            <div className={ui.stat}>
              <div className={ui.statLabel}>Total collected</div>
              <div className={ui.statValue}>{formatCurrency(reading.totalCollected)}</div>
              <div className={ui.statHint}>
                {reading.transactionCount} sales · {reading.itemsSold} items
              </div>
            </div>
            <div className={ui.stat}>
              <div className={ui.statLabel}>Voided</div>
              <div className={ui.statValue}>{formatCurrency(reading.voidedAmount)}</div>
              <div className={ui.statHint}>{reading.voidedCount} sales</div>
            </div>
          </div>

          <div className={ui.grid2}>
            <section className={ui.card}>
              <h2 className={ui.cardTitle} style={{ marginBottom: 8 }}>By payment method</h2>
              <table className={ui.table}>
                <tbody>
                  {reading.byPayment.map((row) => (
                    <tr key={row.method}>
                      <td>{METHOD_LABEL[row.method] ?? row.method}</td>
                      <td className={ui.num}>{row.count} sales</td>
                      <td className={ui.num}>{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  {reading.byPayment.length === 0 && (
                    <tr>
                      <td className={ui.empty}>No sales on this date.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {isManager && reading.byCashier.length > 0 && (
                <>
                  <h2 className={ui.cardTitle} style={{ margin: '16px 0 8px' }}>By cashier</h2>
                  <table className={ui.table}>
                    <tbody>
                      {reading.byCashier.map((row) => (
                        <tr key={row.cashierId}>
                          <td>{row.name}</td>
                          <td className={ui.num}>{row.count} sales</td>
                          <td className={ui.num}>{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>

            <section className={ui.card}>
              <h2 className={ui.cardTitle} style={{ marginBottom: 8 }}>By category</h2>
              <table className={ui.table}>
                <tbody>
                  {reading.byCategory.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td className={ui.num}>{row.quantity} items</td>
                      <td className={ui.num}>{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 className={ui.cardTitle} style={{ margin: '16px 0 8px' }}>Top items</h2>
              <table className={ui.table}>
                <tbody>
                  {reading.topItems.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td className={ui.num}>{row.quantity} sold</td>
                      <td className={ui.num}>{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className={`${ui.card} ${ui.noPrint}`}>
            <h2 className={ui.cardTitle} style={{ marginBottom: 8 }}>Transaction log</h2>
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Sale</th>
                    <th>Time</th>
                    <th>Cashier</th>
                    <th>Member</th>
                    <th>Paid by</th>
                    <th className={ui.num}>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td className={ui.strong}>{sale.transactionNumber}</td>
                      <td>{formatManilaTime(sale.createdAt)}</td>
                      <td>{sale.cashierName}</td>
                      <td>{sale.memberName ?? '—'}</td>
                      <td>{METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</td>
                      <td className={ui.num}>{formatCurrency(sale.totalAmount)}</td>
                      <td>
                        <span className={`${ui.badge} ${sale.status === 'COMPLETED' ? ui.badgeGreen : ui.badgeRed}`}>
                          {sale.status === 'COMPLETED' ? 'Completed' : 'Voided'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={7} className={ui.empty}>
                        No sales on this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {props.tab === 'cash' && (
        <section className={`${ui.card} print-area`}>
          <div className={ui.cardHeader}>
            <h2 className={ui.cardTitle}>Cash drawers — {longDate(date)}</h2>
            <span className={ui.muted}>Expected cash = opening float + cash sales + member payments collected.</span>
          </div>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Cashier</th>
                  <th className={ui.num}>Opening float</th>
                  <th className={ui.num}>Cash sales</th>
                  <th className={ui.num}>Collections</th>
                  <th className={ui.num}>Expected</th>
                  <th className={ui.num}>Counted</th>
                  <th>Result</th>
                  <th className={ui.noPrint} />
                </tr>
              </thead>
              <tbody>
                {drawers.map((drawer) => (
                  <tr key={drawer.cashierId}>
                    <td className={ui.strong}>{drawer.cashierName}</td>
                    <td className={ui.num}>{drawer.count ? formatCurrency(drawer.count.openingFloat) : '—'}</td>
                    <td className={ui.num}>{formatCurrency(drawer.cashSales)}</td>
                    <td className={ui.num}>{formatCurrency(drawer.collections)}</td>
                    <td className={ui.num}>{drawer.count ? formatCurrency(drawer.count.expectedCash) : '—'}</td>
                    <td className={ui.num}>{drawer.count ? formatCurrency(drawer.count.countedCash) : '—'}</td>
                    <td>
                      {drawer.count ? varianceBadge(drawer.count.variance) : <span className={`${ui.badge} ${ui.badgeAmber}`}>Not counted</span>}
                      {drawer.count?.notes && <div className={ui.muted}>{drawer.count.notes}</div>}
                    </td>
                    <td className={ui.noPrint}>
                      {drawer.count ? (
                        isManager && (
                          <button
                            className={`${ui.btn} ${ui.btnSmall}`}
                            disabled={pending}
                            onClick={() => run(() => reopenCashCountAction(drawer.count!.id))}
                          >
                            Reopen
                          </button>
                        )
                      ) : (
                        <button
                          className={`${ui.btn} ${ui.btnSmall} ${ui.btnPrimary}`}
                          onClick={() => {
                            setOpeningFloat('1000');
                            setCountedCash('');
                            setNotes('');
                            setDialog({ kind: 'count', drawer });
                          }}
                        >
                          Count drawer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {drawers.length === 0 && (
                  <tr>
                    <td colSpan={8} className={ui.empty}>
                      No cash activity on this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {props.tab === 'vendors' && (
        <section className={`${ui.card} print-area`}>
          <div className={ui.cardHeader}>
            <div>
              <h2 className={ui.cardTitle}>Vendor split — {longDate(date)}</h2>
              <span className={ui.muted}>Consigned goods: the cooperative keeps its commission and owes the vendor the rest.</span>
            </div>
            <button
              className={`${ui.btn} ${ui.btnPrimary} ${ui.noPrint}`}
              onClick={() => {
                setVendorForm({ name: '', contactPerson: '', phone: '', commissionPercent: '15' });
                setDialog({ kind: 'vendor', vendor: null });
              }}
            >
              + Add vendor
            </button>
          </div>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className={ui.num}>Coop commission</th>
                  <th className={ui.num}>Units sold</th>
                  <th className={ui.num}>Gross sales</th>
                  <th className={ui.num}>Coop share</th>
                  <th className={ui.num}>Vendor share</th>
                  <th className={ui.num}>Unpaid to vendor</th>
                  <th className={ui.noPrint} />
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <div className={ui.strong}>{vendor.name}</div>
                      <div className={ui.muted}>
                        {vendor.productCount} products{vendor.contactPerson ? ` · ${vendor.contactPerson}` : ''}
                      </div>
                    </td>
                    <td className={ui.num}>{vendor.commissionPercent}%</td>
                    <td className={ui.num}>{vendor.unitsSold}</td>
                    <td className={ui.num}>{formatCurrency(vendor.grossSales)}</td>
                    <td className={ui.num}>{formatCurrency(vendor.commission)}</td>
                    <td className={ui.num}>{formatCurrency(vendor.vendorShare)}</td>
                    <td className={`${ui.num} ${ui.strong}`}>{formatCurrency(vendor.balanceDue)}</td>
                    <td className={ui.noPrint}>
                      <div className={ui.row} style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button
                          className={`${ui.btn} ${ui.btnSmall} ${ui.btnPrimary}`}
                          disabled={vendor.balanceDue <= 0}
                          onClick={() => {
                            setAmount(vendor.balanceDue.toFixed(2));
                            setDialog({ kind: 'payout', vendor });
                          }}
                        >
                          Pay out
                        </button>
                        <button
                          className={`${ui.btn} ${ui.btnSmall}`}
                          onClick={() => {
                            setVendorForm({
                              name: vendor.name,
                              contactPerson: vendor.contactPerson ?? '',
                              phone: vendor.phone ?? '',
                              commissionPercent: String(vendor.commissionPercent),
                            });
                            setDialog({ kind: 'vendor', vendor });
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={8} className={ui.empty}>
                      No vendors yet. Add one, then mark a product as consigned by that vendor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dialog?.kind === 'count' && (
        <Modal
          title={`Count drawer: ${dialog.drawer.cashierName}`}
          hint={`${longDate(date)}. Cash sales ${formatCurrency(dialog.drawer.cashSales)}, collections ${formatCurrency(dialog.drawer.collections)}.`}
          onClose={close}
        >
          <div className={ui.formGrid}>
            <label className={ui.field}>
              <span className={ui.label}>Opening float (₱)</span>
              <input className={ui.input} inputMode="decimal" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Cash counted in drawer (₱)</span>
              <input className={ui.input} inputMode="decimal" autoFocus value={countedCash} onChange={(event) => setCountedCash(event.target.value)} />
            </label>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Notes</span>
              <input className={ui.input} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>
          <div className={ui.stat} style={{ marginTop: 12 }}>
            <div className={ui.statLabel}>Expected {formatCurrency(expected(dialog.drawer, Number(openingFloat) || 0))}</div>
            <div className={`${ui.statValue} ${liveVariance !== null && liveVariance < 0 ? ui.negative : ''}`}>
              {liveVariance === null
                ? '—'
                : liveVariance === 0
                  ? 'Exact'
                  : liveVariance > 0
                    ? `${formatCurrency(liveVariance)} over`
                    : `${formatCurrency(-liveVariance)} short`}
            </div>
          </div>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending || countedCash === ''}
              onClick={() =>
                run(
                  () => submitCashCountAction({ date, cashierId: dialog.drawer.cashierId, openingFloat, countedCash, notes }),
                  close
                )
              }
            >
              Submit count
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'vendor' && (
        <Modal title={dialog.vendor ? `Edit ${dialog.vendor.name}` : 'Add vendor'} onClose={close}>
          <div className={ui.formGrid}>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Vendor name</span>
              <input className={ui.input} value={vendorForm.name} onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Contact person</span>
              <input className={ui.input} value={vendorForm.contactPerson} onChange={(event) => setVendorForm({ ...vendorForm, contactPerson: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Phone</span>
              <input className={ui.input} value={vendorForm.phone} onChange={(event) => setVendorForm({ ...vendorForm, phone: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Cooperative&apos;s commission (%)</span>
              <input className={ui.input} inputMode="decimal" value={vendorForm.commissionPercent} onChange={(event) => setVendorForm({ ...vendorForm, commissionPercent: event.target.value })} />
            </label>
          </div>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending}
              onClick={() => run(() => saveVendorAction({ id: dialog.vendor?.id, ...vendorForm }), close)}
            >
              Save vendor
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'payout' && (
        <Modal
          title={`Pay out: ${dialog.vendor.name}`}
          hint={`${formatCurrency(dialog.vendor.balanceDue)} is owed. Paid in cash from the store.`}
          onClose={close}
        >
          <label className={ui.field}>
            <span className={ui.label}>Amount (₱)</span>
            <input className={ui.input} inputMode="decimal" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending || !amount}
              onClick={() => run(() => payVendorAction({ vendorId: dialog.vendor.id, amount }), close)}
            >
              Pay vendor
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
