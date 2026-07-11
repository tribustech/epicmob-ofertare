'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import type { FormState } from '@/lib/forms/form-action';

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
        <p className="mb-2 rounded bg-red-50 px-2 py-1 text-sm text-red-700">{state.error}</p>
      )}
      {props.children}
    </form>
  );
}
