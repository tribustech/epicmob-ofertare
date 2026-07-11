'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/forms/form-action';
import { Button } from '@/components/ui/button';

export function DeleteButton({ action, label }: { action: () => Promise<FormState>; label?: string }) {
  const [state, dispatch] = useActionState(async () => action(), {} as FormState);
  return (
    <form
      action={dispatch}
      onSubmit={(e) => {
        if (!confirm('Sigur ștergi această intrare?')) e.preventDefault();
      }}
    >
      {state.error && <p className="mb-1 max-w-56 text-xs text-destructive">{state.error}</p>}
      <Button type="submit" variant="destructive" size="sm">
        {label ?? 'Șterge'}
      </Button>
    </form>
  );
}
