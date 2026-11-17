'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import type { ActionResponse } from '@/utils/response';

/**
 * Runs a server action from a client component: shows the result as a toast
 * and refreshes the page's server data when it succeeds.
 */
export function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function run<T>(action: () => Promise<ActionResponse<T>>, onSuccess?: (data: T) => void) {
    startTransition(async () => {
      try {
        const response = await action();
        if (response.success) {
          if (response.message) toast.success(response.message);
          onSuccess?.(response.data as T);
          router.refresh();
        } else {
          toast.error(response.error ?? 'Something went wrong.');
        }
      } catch {
        toast.error('Could not reach the server. Please try again.');
      }
    });
  }

  return { run, pending };
}
