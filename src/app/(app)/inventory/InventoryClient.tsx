'use client';

import { Download, Package, Plus, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import styles from './page.module.css';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import { useAction } from '@/lib/useAction';
import { formatCurrency, formatManilaDateTime } from '@/utils/formatters';
import {
  archiveInventoryItemAction,
  createInventoryItemAction,
  logSpoilageAction,
  receiveDeliveryAction,
  updateInventoryItemAction,
} from '@/actions/inventoryActions';
import type { InventoryRow, MovementRow } from '@/services/inventoryService';

const EMPTY_FORM = {
  name: '',
  packaging: '',
  sku: '',
  category: '',
  supplier: '',
  deliveryDays: '',
  unit: 'pcs',
  reorderLevel: '5',
  parLevel: '50',
};

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIVE: 'Delivery',
  SPOILAGE: 'Spoilage',
  VOID_RETURN: 'Returned (void)',
};

type Dialog =
  | { kind: 'item'; item: InventoryRow | null }
  | { kind: 'receive'; item: InventoryRow }
  | { kind: 'spoilage'; item: InventoryRow }
  | null;

export default function InventoryClient({ items, movements }: { items: InventoryRow[]; movements: MovementRow[] }) {
  const { run, pending } = useAction();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [category, setCategory] = useState('All');
  const [dialog, setDialog] = useState<Dialog>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [paymentType, setPaymentType] = useState('CASH');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((item) => item.category)))], [items]);

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) return false;
    if (category !== 'All' && item.category !== category) return false;
    return statusFilter === 'All' || item.status === statusFilter;
  });

  const lowCount = items.filter((item) => item.status === 'Low Stock').length;
  const emptyCount = items.filter((item) => item.status === 'Empty').length;
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);

  const close = () => setDialog(null);

  function openItem(item: InventoryRow | null) {
    setForm(
      item
        ? {
            name: item.name,
            packaging: item.packaging,
            sku: item.sku,
            category: item.category,
            supplier: item.supplier,
            deliveryDays: item.deliveryDays,
            unit: item.unit,
            reorderLevel: String(item.reorderLevel),
            parLevel: String(item.parLevel),
          }
        : EMPTY_FORM
    );
    setDialog({ kind: 'item', item });
  }

  function openReceive(item: InventoryRow) {
    setQuantity('');
    setUnitCost(item.unitCost ? item.unitCost.toFixed(2) : '');
    setPaymentType('CASH');
    setReference('');
    setDialog({ kind: 'receive', item });
  }

  function openSpoilage(item: InventoryRow) {
    setQuantity('');
    setReason('');
    setDialog({ kind: 'spoilage', item });
  }

  function exportCsv() {
    const header = ['SKU', 'Item', 'Category', 'Supplier', 'Unit cost', 'In stock', 'Unit', 'Reorder level', 'Status'];
    const rows = filtered.map((item) =>
      [item.sku, item.name, item.category, item.supplier, item.unitCost, item.stock, item.unit, item.reorderLevel, item.status]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inventory.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const statusClass = (status: string) =>
    status === 'Low Stock' ? styles.statusLow : status === 'Empty' ? styles.statusEmpty : styles.statusOptimal;

  const field = (key: keyof typeof EMPTY_FORM, label: string, span = false) => (
    <label className={`${ui.field} ${span ? ui.span2 : ''}`}>
      <span className={ui.label}>{label}</span>
      <input
        className={ui.input}
        value={form[key]}
        onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))}
      />
    </label>
  );

  return (
    <div className={styles.container} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className={ui.statGrid}>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Items tracked</div>
          <div className={ui.statValue}>{items.length}</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Low stock</div>
          <div className={`${ui.statValue} ${lowCount ? ui.negative : ''}`}>{lowCount}</div>
          <div className={ui.statHint}>At or below reorder level</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Out of stock</div>
          <div className={`${ui.statValue} ${emptyCount ? ui.negative : ''}`}>{emptyCount}</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statLabel}>Stock value at cost</div>
          <div className={ui.statValue}>{formatCurrency(totalValue)}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.controls}>
          <div className={styles.searchContainer}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search SKU, Item Name..."
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <select className={ui.select} style={{ width: 'auto' }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Status">
              {['All', 'Optimal', 'Low Stock', 'Empty'].map((option) => (
                <option key={option} value={option}>
                  {option === 'All' ? 'All statuses' : option}
                </option>
              ))}
            </select>
            <select className={ui.select} style={{ width: 'auto' }} value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option === 'All' ? 'All categories' : option}
                </option>
              ))}
            </select>
            <button className={styles.filterButton} onClick={exportCsv}>
              <Download size={16} aria-hidden="true" />
              Export
            </button>
            <button className={styles.addButton} onClick={() => openItem(null)}>
              <Plus size={16} aria-hidden="true" />
              Add Item
            </button>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Item Details</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Unit Cost (₱)</th>
                <th>In Stock</th>
                <th>Reorder At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemIcon}>
                        <Package size={20} aria-hidden="true" />
                      </div>
                      <div className={styles.itemDetails}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemPackaging}>{item.packaging}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.sku}>{item.sku}</span>
                  </td>
                  <td>
                    <span className={styles.categoryBadge}>{item.category}</span>
                  </td>
                  <td>
                    <div className={styles.supplierInfo}>
                      <span className={styles.supplierName}>{item.supplier}</span>
                      <span className={styles.supplierDays}>{item.deliveryDays}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.price}>{formatCurrency(item.unitCost)}</span>
                  </td>
                  <td>
                    <span className={`${styles.stockInfo} ${item.status === 'Optimal' ? styles.normal : styles.low}`}>
                      {item.stock} {item.unit}
                    </span>
                  </td>
                  <td>{item.reorderLevel}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${statusClass(item.status)}`}>
                      <span className={styles.statusDot}></span>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <div className={ui.row} style={{ flexWrap: 'nowrap' }}>
                      <button className={`${ui.btn} ${ui.btnSmall} ${ui.btnPrimary}`} onClick={() => openReceive(item)}>
                        Receive
                      </button>
                      <button className={`${ui.btn} ${ui.btnSmall}`} onClick={() => openSpoilage(item)} disabled={item.stock <= 0}>
                        Spoilage
                      </button>
                      <button className={`${ui.btn} ${ui.btnSmall}`} onClick={() => openItem(item)}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className={ui.empty}>
                    No inventory items match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <div className={styles.showingText}>
            Showing {filtered.length} of {items.length} items
          </div>
        </div>
      </div>

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>Deliveries and spoilage log</h2>
          <span className={ui.muted}>Latest {movements.length} entries. Sales deductions are recorded automatically.</span>
        </div>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th>Type</th>
                <th className={ui.num}>Quantity</th>
                <th className={ui.num}>Unit cost</th>
                <th className={ui.num}>Stock after</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatManilaDateTime(movement.createdAt)}</td>
                  <td className={ui.strong}>{movement.itemName}</td>
                  <td>
                    <span className={`${ui.badge} ${movement.type === 'SPOILAGE' ? ui.badgeRed : ui.badgeGreen}`}>
                      {MOVEMENT_LABEL[movement.type] ?? movement.type}
                    </span>
                  </td>
                  <td className={ui.num}>
                    {movement.quantity > 0 ? '+' : ''}
                    {movement.quantity} {movement.unit}
                  </td>
                  <td className={ui.num}>{formatCurrency(movement.unitCost)}</td>
                  <td className={ui.num}>{movement.stockAfter}</td>
                  <td>{movement.note ?? movement.reference ?? ''}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={7} className={ui.empty}>
                    Nothing logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {dialog?.kind === 'item' && (
        <Modal
          title={dialog.item ? `Edit ${dialog.item.name}` : 'Add inventory item'}
          hint="Stock starts at zero. Use Receive to bring stock in."
          onClose={close}
        >
          <div className={ui.formGrid}>
            {field('name', 'Item name', true)}
            {field('sku', 'SKU')}
            {field('category', 'Category')}
            {field('packaging', 'Packaging')}
            {field('unit', 'Unit (pcs, kg, packs)')}
            {field('supplier', 'Supplier')}
            {field('deliveryDays', 'Delivery days')}
            {field('reorderLevel', 'Reorder level (low-stock threshold)')}
            {field('parLevel', 'Full stock level')}
          </div>
          <div className={ui.modalActions} style={{ justifyContent: 'space-between' }}>
            <div>
              {dialog.item && (
                <button
                  className={`${ui.btn} ${ui.btnDanger}`}
                  disabled={pending}
                  onClick={() => run(() => archiveInventoryItemAction(dialog.item!.id), close)}
                >
                  Archive
                </button>
              )}
            </div>
            <div className={ui.row}>
              <button className={ui.btn} onClick={close}>
                Cancel
              </button>
              <button
                className={`${ui.btn} ${ui.btnPrimary}`}
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      dialog.item
                        ? updateInventoryItemAction(dialog.item.id, form)
                        : createInventoryItemAction(form),
                    close
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'receive' && (
        <Modal
          title={`Receive delivery: ${dialog.item.name}`}
          hint={`Currently ${dialog.item.stock} ${dialog.item.unit} on hand.`}
          onClose={close}
        >
          <div className={ui.formGrid}>
            <label className={ui.field}>
              <span className={ui.label}>Quantity received ({dialog.item.unit})</span>
              <input className={ui.input} inputMode="decimal" autoFocus value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Cost per {dialog.item.unit} (₱)</span>
              <input className={ui.input} inputMode="decimal" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Payment</span>
              <select className={ui.select} value={paymentType} onChange={(event) => setPaymentType(event.target.value)}>
                <option value="CASH">Paid in cash</option>
                <option value="ACCOUNT">On account (pay supplier later)</option>
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Delivery receipt no.</span>
              <input className={ui.input} value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
          </div>
          <p className={ui.muted} style={{ marginTop: 8 }}>
            Use a cost of 0 for consigned goods the cooperative does not own.
          </p>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={pending || !quantity || unitCost === ''}
              onClick={() =>
                run(
                  () => receiveDeliveryAction({ itemId: dialog.item.id, quantity, unitCost, paymentType, reference }),
                  close
                )
              }
            >
              Receive stock
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'spoilage' && (
        <Modal
          title={`Log spoilage or waste: ${dialog.item.name}`}
          hint={`Currently ${dialog.item.stock} ${dialog.item.unit} on hand. This is written off as an expense.`}
          onClose={close}
        >
          <div className={ui.formGrid}>
            <label className={ui.field}>
              <span className={ui.label}>Quantity lost ({dialog.item.unit})</span>
              <input className={ui.input} inputMode="decimal" autoFocus value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Reason</span>
              <input className={ui.input} placeholder="Expired, damaged, spilled..." value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
          </div>
          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={close}>
              Cancel
            </button>
            <button
              className={`${ui.btn} ${ui.btnDanger}`}
              disabled={pending || !quantity || !reason.trim()}
              onClick={() => run(() => logSpoilageAction({ itemId: dialog.item.id, quantity, reason }), close)}
            >
              Log spoilage
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
