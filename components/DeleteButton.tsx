'use client';

import { useActionState } from 'react';
import { Trash2 } from 'lucide-react';
import type { FormState } from '@/lib/forms/form-action';
import { Button } from '@/components/ui/button';

export function DeleteButton({ action, label, iconOnly, confirmMessage, floatingError }: {
  action: () => Promise<FormState>; label?: string; iconOnly?: boolean; confirmMessage?: string;
  /** eroarea nu încape în coloană (liste) — o scoatem peste conținut, aliniată la dreapta */
  floatingError?: boolean;
}) {
  const [state, dispatch] = useActionState(async () => action(), {} as FormState);
  return (
    <form
      action={dispatch}
      className={floatingError ? 'relative' : undefined}
      onSubmit={(e) => {
        if (!confirm(confirmMessage ?? 'Sigur ștergi această intrare?')) e.preventDefault();
      }}
    >
      {state.error && (
        <p className={floatingError
          ? 'absolute right-0 top-full z-10 mt-1 w-64 rounded-lg bg-card p-2 text-left text-xs text-destructive shadow-lg ring-1 ring-border'
          : 'mb-1 max-w-56 text-xs text-destructive'}
        >{state.error}</p>
      )}
      {iconOnly ? (
        <Button type="submit" variant="destructive" size="icon-sm" title={label ?? 'Șterge'} aria-label={label ?? 'Șterge'}>
          <Trash2 />
        </Button>
      ) : (
        <Button type="submit" variant="destructive" size="sm">
          {label ?? 'Șterge'}
        </Button>
      )}
    </form>
  );
}
