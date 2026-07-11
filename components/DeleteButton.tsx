'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/forms/form-action';

export function DeleteButton({ action, label }: { action: () => Promise<FormState>; label?: string }) {
  const [state, dispatch] = useActionState(async () => action(), {} as FormState);
  return (
    <form
      action={dispatch}
      onSubmit={(e) => {
        if (!confirm('Sigur ștergi această intrare?')) e.preventDefault();
      }}
    >
      {state.error && <p className="mb-1 max-w-56 text-xs text-red-700">{state.error}</p>}
      <button type="submit" className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
        {label ?? 'Șterge'}
      </button>
    </form>
  );
}
