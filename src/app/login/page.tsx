import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DEMO_USERS } from '@/lib/auth';
import { getSession } from '@/lib/session';
import LoginForm from './LoginForm';
import styles from './login.module.css';

export const metadata: Metadata = {
  title: 'Sign In · PRISM Management System',
};

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
          <div className={styles.seal}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className={styles.brandText}>
            <span className={styles.prismText}>PRISM</span>
            <span className={styles.subText}>MANAGEMENT SYSTEM</span>
          </div>
        </div>

        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to continue to the canteen system</p>

        <LoginForm />

        {/* Prototype affordance — drop this block once real accounts exist.
            Rendered from DEMO_USERS so it can never drift from the real logins. */}
        <div className={styles.hint}>
          <p className={styles.hintTitle}>Demo Accounts</p>
          {DEMO_USERS.map((account) => (
            <div key={account.id} className={styles.hintRow}>
              <span
                className={`${styles.badge} ${
                  account.role === 'ADMIN' ? styles.badgeAdmin : styles.badgeUser
                }`}
              >
                {account.role === 'ADMIN' ? 'Admin' : 'User'}
              </span>
              <span className={styles.hintCreds}>
                {account.username} / {account.password}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
