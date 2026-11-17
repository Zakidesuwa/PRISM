'use client';

import { Plus, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import styles from './page.module.css';
import ui from '@/styles/ui.module.css';
import Modal from '@/components/Modal/Modal';
import { useAction } from '@/lib/useAction';
import { formatCurrency } from '@/utils/formatters';
import { createProductAction, setProductActiveAction, updateProductAction } from '@/actions/inventoryActions';
import type { ProductRow } from '@/services/productService';

interface Props {
  products: ProductRow[];
  inventory: { id: number; name: string; unit: string }[];
  vendors: { id: number; name: string; commissionPercent: number }[];
}

interface FormState {
  name: string;
  sku: string;
  category: string;
  price: string;
  vendorId: string;
  parts: { inventoryItemId: string; quantity: string }[];
}

const EMPTY: FormState = { name: '', sku: '', category: '', price: '', vendorId: '', parts: [{ inventoryItemId: '', quantity: '1' }] };

export default function ProductsClient({ products, inventory, vendors }: Props) {
  const { run, pending } = useAction();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('name');
  const [editing, setEditing] = useState<ProductRow | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((product) => product.category)))], [products]);

  const filtered = products
    .filter((product) => {
      const q = query.trim().toLowerCase();
      if (q && !product.name.toLowerCase().includes(q) && !product.sku.toLowerCase().includes(q)) return false;
      return category === 'All' || product.category === category;
    })
    .sort((a, b) =>
      sort === 'price'
        ? b.price - a.price
        : sort === 'stock'
          ? (a.available ?? Infinity) - (b.available ?? Infinity)
          : a.name.localeCompare(b.name)
    );

  function open(product: ProductRow | 'new') {
    setForm(
      product === 'new'
        ? EMPTY
        : {
            name: product.name,
            sku: product.sku,
            category: product.category,
            price: product.price.toFixed(2),
            vendorId: product.vendorId ? String(product.vendorId) : '',
            parts: product.ingredients.length
              ? product.ingredients.map((part) => ({
                  inventoryItemId: String(part.inventoryItemId),
                  quantity: String(part.quantityRequired),
                }))
              : [],
          }
    );
    setEditing(product);
  }

  function save() {
    const input = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      price: form.price,
      vendorId: form.vendorId ? Number(form.vendorId) : null,
      ingredients: form.parts
        .filter((part) => part.inventoryItemId)
        .map((part) => ({ inventoryItemId: Number(part.inventoryItemId), quantity: part.quantity })),
    };
    run(
      () => (editing === 'new' || editing === null ? createProductAction(input) : updateProductAction(editing.id, input)),
      () => setEditing(null)
    );
  }

  const setPart = (index: number, patch: Partial<FormState['parts'][number]>) =>
    setForm((previous) => ({
      ...previous,
      parts: previous.parts.map((part, position) => (position === index ? { ...part, ...patch } : part)),
    }));

  const stockClass = (available: number | null) =>
    available === null ? styles.stockHigh : available === 0 ? styles.stockLow : available < 10 ? styles.stockMedium : styles.stockHigh;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleContainer}>
          <h1>Products</h1>
          <p>What the cashier sells. Stock comes from the inventory items each product uses.</p>
        </div>
        <button className={styles.addButton} onClick={() => open('new')}>
          <Plus size={16} aria-hidden="true" />
          Add New Product
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.controls}>
          <div className={styles.searchContainer}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search products by name or SKU..."
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <select className={ui.select} style={{ width: 'auto' }} value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option === 'All' ? 'All categories' : option}
                </option>
              ))}
            </select>
            <select className={ui.select} style={{ width: 'auto' }} value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
              <option value="name">Sort: name</option>
              <option value="price">Sort: highest price</option>
              <option value="stock">Sort: lowest stock</option>
            </select>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product Info</th>
                <th>Category</th>
                <th>Price (₱)</th>
                <th>Cost (₱)</th>
                <th>Available</th>
                <th>Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} style={product.isActive ? undefined : { opacity: 0.55 }}>
                  <td>
                    <div className={styles.productInfo}>
                      <div className={styles.productDetails}>
                        <span className={styles.productName}>{product.name}</span>
                        <span className={styles.productSku}>SKU: {product.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.category}>{product.category}</span>
                  </td>
                  <td>
                    <span className={styles.price}>{formatCurrency(product.price)}</span>
                  </td>
                  <td>{product.vendorId ? '—' : formatCurrency(product.unitCost)}</td>
                  <td>
                    <span className={`${styles.stockBadge} ${stockClass(product.available)}`}>
                      {product.available === null ? 'Not tracked' : `${product.available} Units`}
                    </span>
                  </td>
                  <td>
                    {product.vendorName ? (
                      <span className={`${ui.badge} ${ui.badgeAmber}`}>Consigned: {product.vendorName}</span>
                    ) : (
                      <span className={ui.muted}>
                        {product.ingredients.map((part) => `${part.quantityRequired} × ${part.name}`).join(', ') || 'No stock link'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className={ui.row} style={{ flexWrap: 'nowrap' }}>
                      <button className={`${ui.btn} ${ui.btnSmall}`} onClick={() => open(product)}>
                        Edit
                      </button>
                      <button
                        className={`${ui.btn} ${ui.btnSmall}`}
                        disabled={pending}
                        onClick={() => run(() => setProductActiveAction(product.id, !product.isActive))}
                      >
                        {product.isActive ? 'Take off sale' : 'Put on sale'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className={ui.empty}>
                    No products match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <div className={styles.showingText}>
            Showing {filtered.length} of {products.length} products
          </div>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add product' : `Edit ${editing.name}`}
          hint="List the inventory items one unit of this product uses. A resale item uses one item × 1."
          onClose={() => setEditing(null)}
        >
          <div className={ui.formGrid}>
            <label className={`${ui.field} ${ui.span2}`}>
              <span className={ui.label}>Product name</span>
              <input className={ui.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>SKU</span>
              <input className={ui.input} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Category</span>
              <input className={ui.input} list="product-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
              <datalist id="product-categories">
                {categories.filter((option) => option !== 'All').map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Selling price (₱)</span>
              <input className={ui.input} inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Consigned by vendor</span>
              <select className={ui.select} value={form.vendorId} onChange={(event) => setForm({ ...form, vendorId: event.target.value })}>
                <option value="">No — owned by the cooperative</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name} (coop keeps {vendor.commissionPercent}%)
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={ui.label} style={{ margin: '16px 0 8px' }}>
            Inventory used per unit sold
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {form.parts.map((part, index) => (
              <div key={index} className={ui.row} style={{ flexWrap: 'nowrap' }}>
                <select
                  className={ui.select}
                  value={part.inventoryItemId}
                  onChange={(event) => setPart(index, { inventoryItemId: event.target.value })}
                >
                  <option value="">Choose inventory item…</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
                <input
                  className={ui.input}
                  style={{ width: 90 }}
                  inputMode="decimal"
                  aria-label="Quantity used"
                  value={part.quantity}
                  onChange={(event) => setPart(index, { quantity: event.target.value })}
                />
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnSmall}`}
                  onClick={() => setForm({ ...form, parts: form.parts.filter((_, position) => position !== index) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnSmall}`}
                onClick={() => setForm({ ...form, parts: [...form.parts, { inventoryItemId: '', quantity: '1' }] })}
              >
                + Add inventory item
              </button>
            </div>
          </div>

          <div className={ui.modalActions}>
            <button className={ui.btn} onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className={`${ui.btn} ${ui.btnPrimary}`} disabled={pending} onClick={save}>
              Save product
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
