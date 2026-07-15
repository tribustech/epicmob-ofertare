'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function NewProjectPanel({ form }: { form: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Proiecte</h1>
        <Button onClick={() => setOpen((o) => !o)}>Proiect nou</Button>
      </div>
      {open && (
        <div className="rounded-xl bg-card p-5 ring-1 ring-border">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[15px] font-bold">Proiect nou</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              Anulează
            </button>
          </div>
          {form}
        </div>
      )}
    </div>
  );
}
