'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import type { FormState } from '@/lib/forms/form-action';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ActionForm(props: {
  action: (fd: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, dispatch] = useActionState(
    async (_prev: FormState, fd: FormData) => props.action(fd),
    {} as FormState,
  );
  return (
    <form action={dispatch} className={props.className}>
      {state.error && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {props.children}
    </form>
  );
}
