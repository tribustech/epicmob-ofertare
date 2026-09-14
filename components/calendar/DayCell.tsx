'use client';

import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ModalCloseContext } from '@/components/modal-close';

/** Celula unei zile: click oriunde pe spațiul liber (inclusiv pe număr) deschide modalul „Eveniment nou";
 *  click-urile pe link-uri/butoane din celulă (pastile, „+N", puncte) rămân ale lor. */
export function DayCell({ className, title, form, children }: {
  className: string; title: string; form: ReactNode; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={className}
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest('a, button, [role="dialog"]')) return;
          setOpen(true);
        }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setOpen(true); } }}
      >
        {children}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <ModalCloseContext.Provider value={() => setOpen(false)}>{form}</ModalCloseContext.Provider>
        </DialogContent>
      </Dialog>
    </>
  );
}
