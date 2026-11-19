import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import LoginForm from './LoginForm';
import styles from './login.module.css';

export const metadata: Metadata = {
  title: 'Sign In · PRISM Management System',
};

const SEEDED_LOGINS = [
  { label: 'Admin', username: 'admin', password: 'admin123' },
  { label: 'Manager', username: 'manager', password: 'manager123' },
  { label: 'Cashier', username: 'cashier', password: 'cashier123' },
  { label: 'Store', username: 'storekeeper', password: 'store123' },
];

export default async function LoginPage() {
  // Already signed in? Skip the form and go where this role belongs.
  const user = await getSession();

  if (user) {
    redirect(user.homePath);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image src="/logos/prism.png" alt="" width={44} height={44} preload className={styles.seal} />
          <div className={styles.brandText}>
            <span className={styles.prismText}>PRISM</span>
            <span className={styles.subText}>MANAGEMENT SYSTEM</span>
          </div>
        </div>

        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to continue to the canteen system</p>

        <LoginForm />

        {/* The accounts created by `npm run db:seed`. Hidden in production. */}
        {process.env.NODE_ENV !== 'production' && (
          <div className={styles.hint}>
            <p className={styles.hintTitle}>Demo Accounts</p>
            {SEEDED_LOGINS.map((account) => (
              <div key={account.username} className={styles.hintRow}>
                <span
                  className={`${styles.badge} ${
                    account.label === 'Admin' ? styles.badgeAdmin : styles.badgeUser
                  }`}
                >
                  {account.label}
                </span>
                <span className={styles.hintCreds}>
                  {account.username} / {account.password}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
