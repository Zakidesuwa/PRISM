'use client';

import React, { useState } from 'react';
import styles from './page.module.css';
import { posItems } from '@/data/mockData';
import type { POSItem } from '@/types';

const categories = ['All Items', 'Hot Meals', 'Snacks', 'Beverages', 'Desserts'];

interface CartItem {
  product: POSItem;
  quantity: number;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(15, 23, 42, 0.6)',
  padding: 24,
};

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  backgroundColor: '#ffffff',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

export default function POSPage() {
  const [activeCategory, setActiveCategory] = useState('All Items');
  const [cart, setCart] = useState<CartItem[]>([
    { product: posItems[0], quantity: 2 },
    { product: posItems[3], quantity: 1 },
  ]);
  const [orderNumber, setOrderNumber] = useState(4092);
  const [isPaymentSuccessOpen, setIsPaymentSuccessOpen] = useState(false);
  const [paidOrderDetails, setPaidOrderDetails] = useState<{
    orderNum: number;
    subtotal: number;
    tax: number;
    total: number;
    items: CartItem[];
  } | null>(null);

  const filteredItems = posItems.filter((item) =>
    activeCategory === 'All Items' ? true : item.category === activeCategory
  );

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  function handleAddToCart(item: POSItem) {
    if (!item.inStock) return;
    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.product.id === item.id);
      if (existing) {
        return prevCart.map((ci) =>
          ci.product.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prevCart, { product: item, quantity: 1 }];
    });
  }

  function handleUpdateQuantity(productId: number, delta: number) {
    setCart((prevCart) =>
      prevCart
        .map((ci) => {
          if (ci.product.id === productId) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function handleClearCart() {
    setCart([]);
  }

  function handlePay() {
    if (cart.length === 0) return;
    setPaidOrderDetails({
      orderNum: orderNumber,
      subtotal,
      tax,
      total,
      items: [...cart],
    });
    setIsPaymentSuccessOpen(true);
    setCart([]);
    setOrderNumber((prev) => prev + 1);
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Point of Sales</h1>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.leftPanel}>
          <div className={styles.categoryTabs}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.tab} ${activeCategory === cat ? styles.tabActive : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className={styles.productGrid}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleAddToCart(item)}
                className={`${styles.productCard} ${!item.inStock ? styles.productCardDisabled : ''}`}
                style={{ cursor: item.inStock ? 'pointer' : 'not-allowed' }}
              >
                {!item.inStock && <div className={styles.outOfStockBadge}>OUT OF STOCK</div>}
                <div className={styles.imageArea}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </div>
                <div className={styles.productInfo}>
                  <span className={styles.productName}>{item.name}</span>
                  <span className={styles.productPrice}>₱{item.price.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.orderHeader}>
            <div>
              <h2 className={styles.orderTitle}>Current Order</h2>
              <span className={styles.orderNumber}>Order #{orderNumber}</span>
            </div>
            <button
              type="button"
              className={styles.clearIcon}
              onClick={handleClearCart}
              title="Clear Cart"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>

          <div className={styles.orderItems}>
            {cart.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                Cart is empty. Tap any product on the left to add it to the order.
              </div>
            ) : (
              cart.map((ci) => (
                <div key={ci.product.id} className={styles.orderItem}>
                  <div className={styles.itemDetails}>
                    <div className={styles.itemName}>{ci.product.name}</div>
                    <div className={styles.itemUnitPrice}>₱{ci.product.price.toFixed(2)} / unit</div>
                  </div>
                  <div className={styles.itemControls}>
                    <div className={styles.quantityControls}>
                      <button
                        type="button"
                        className={styles.qtyButton}
                        onClick={() => handleUpdateQuantity(ci.product.id, -1)}
                      >
                        -
                      </button>
                      <span>{ci.quantity}</span>
                      <button
                        type="button"
                        className={styles.qtyButton}
                        onClick={() => handleUpdateQuantity(ci.product.id, 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className={styles.itemTotal}>
                      ₱{(ci.product.price * ci.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.orderSummary}>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>₱{subtotal.toFixed(2)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Tax (5%)</span>
              <span>₱{tax.toFixed(2)}</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>₱{total.toFixed(2)}</span>
            </div>
            <button
              type="button"
              className={styles.payButton}
              onClick={handlePay}
              disabled={cart.length === 0}
              style={{ opacity: cart.length === 0 ? 0.5 : 1, cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              PAY ₱{total.toFixed(2)}
            </button>
          </div>
        </div>
      </main>

      {/* Payment Success Modal Dialog */}
      {isPaymentSuccessOpen && paidOrderDetails && (
        <div
          style={overlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPaymentSuccessOpen(false);
          }}
        >
          <div style={modalStyle}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: '#ECFDF5',
                  color: '#10B981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#111827' }}>Payment Successful</h3>
              <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0' }}>
                Order #{paidOrderDetails.orderNum} · Completed
              </p>
            </div>

            <div style={{ borderTop: '1px dashed #E5E7EB', borderBottom: '1px dashed #E5E7EB', padding: '12px 0', margin: '16px 0' }}>
              {paidOrderDetails.items.map((ci) => (
                <div key={ci.product.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', margin: '6px 0' }}>
                  <span>{ci.quantity}x {ci.product.name}</span>
                  <span>₱{(ci.product.price * ci.quantity).toFixed(2)}</span>
                </div>
              ))}

              <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#111827' }}>
                <span>Total Paid</span>
                <span style={{ color: '#2563EB' }}>₱{paidOrderDetails.total.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setIsPaymentSuccessOpen(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#2563EB',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
