'use client';
import { CircleAlert, Eye, EyeOff, LoaderCircle, LogIn } from 'lucide-react';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { login, type LoginState } from '@/app/actions/auth';
import styles from './login.module.css';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle size={16} className="spin" aria-hidden="true" />
          Signing in…
        </>
      ) : (
        <>
          <LogIn size={16} aria-hidden="true" />
          Sign In
        </>
      )}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className={styles.form}>
      {state.error && (
        <p className={styles.error} role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          {state.error}
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor="username" className={styles.label}>
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          className={styles.input}
          placeholder="Enter your username"
          autoComplete="username"
          autoFocus
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Password
        </label>
        <div className={styles.passwordWrap}>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            className={styles.input}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
