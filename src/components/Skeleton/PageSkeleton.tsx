import { LoaderCircle } from 'lucide-react';
import styles from './Skeleton.module.css';

/**
 * Shown by Next.js (loading.tsx) while a page's data is fetched. The layout
 * stays in place, so the screen never goes blank and nothing jumps when the
 * real content arrives.
 */
export default function PageSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <div className={styles.status} role="status">
        <LoaderCircle size={16} className="spin" aria-hidden="true" />
        Loading…
      </div>
      <div className={`${styles.block} ${styles.title}`} />
      <div className={styles.stats}>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={`${styles.block} ${styles.stat}`} />
        ))}
      </div>
      <div className={`${styles.block} ${styles.panel}`} />
    </div>
  );
}
