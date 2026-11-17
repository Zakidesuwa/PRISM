import type { LucideIcon } from 'lucide-react';
import ui from '@/styles/ui.module.css';

/** "Nothing here yet" that says why and what to do next, instead of a bare line of text. */
export default function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={ui.emptyState}>
      <span className={ui.emptyIcon}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className={ui.emptyTitle}>{title}</span>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  );
}
