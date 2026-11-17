'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import ui from '@/styles/ui.module.css';

interface ModalProps {
  title: string;
  hint?: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, hint, wide, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Lock the page behind the dialog.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Put focus inside: an autoFocus field wins, otherwise the first form field.
    if (dialog && !dialog.contains(document.activeElement)) {
      const field = dialog.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
      (field ?? dialog).focus();
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      // Keep Tab cycling inside the dialog.
      if (event.key === 'Tab' && dialog) {
        const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className={ui.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`${ui.modal} ${wide ? ui.modalWide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ outline: 'none' }}
      >
        <button type="button" className={ui.modalClose} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <h2 className={ui.modalTitle}>{title}</h2>
        {hint ? <p className={ui.modalHint}>{hint}</p> : <div style={{ height: 16 }} />}
        {children}
      </div>
    </div>
  );
}
