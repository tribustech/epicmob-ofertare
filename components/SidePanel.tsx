'use client';

import { useState, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { ModalCloseContext } from '@/components/modal-close';
import { cn } from '@/lib/utils';

/** Panou lateral (drawer dreapta) pentru formulare server. Se închide singur la submit reușit
 *  (ActionForm consumă ModalCloseContext). `footer` (opțional) e randat sub conținut, pe fundal deschis. */
export function SidePanel({ trigger, title, variant, size, className, children, hint }: {
  trigger: string;
  title: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
  className?: string;
  children: ReactNode;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant={variant} size={size} className={className}>{trigger}</Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl bg-card shadow-[0_-8px_30px_rgba(0,0,0,.15)] outline-none',
            'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-[440px] sm:rounded-none sm:shadow-[-8px_0_30px_rgba(0,0,0,.12)]',
            'sm:data-[state=open]:animate-in sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:animate-out sm:data-[state=closed]:slide-out-to-right',
          )}
        >
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <DialogPrimitive.Title className="text-[15px] font-bold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground">
              Anulează
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          <div className="flex-1 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
            <ModalCloseContext.Provider value={() => setOpen(false)}>
              {children}
            </ModalCloseContext.Provider>
          </div>
          {hint && <div className="border-t bg-[#fafaf8] px-6 py-3 text-[12px] text-muted-foreground">{hint}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
