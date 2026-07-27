'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { FormState } from '@/lib/forms/form-action';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useModalClose } from '@/components/modal-close';

export function ActionForm(props: {
  action: (fd: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, dispatch, isPending] = useActionState(
    async (_prev: FormState, fd: FormData) => props.action(fd),
    {} as FormState,
  );
  // dacă formularul e într-un modal, îl închidem la submit reușit (pending true→false fără eroare)
  const closeModal = useModalClose();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) closeModal?.();
    wasPending.current = isPending;
  }, [isPending, state, closeModal]);
  return (
    <form
      action={dispatch}
      className={props.className}
      onSubmit={props.confirm ? (e) => { if (!confirm(props.confirm)) e.preventDefault(); } : undefined}
    >
      {state.error && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {props.children}
    </form>
  );
}
