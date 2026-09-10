'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';

/** Panou lateral deschis de un parametru de URL (?doc=…); închiderea scoate parametrul. */
export function DocumentSheet({ title, closeHref, children }: { title: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) router.push(closeHref); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col bg-card shadow-[-8px_0_30px_rgba(0,0,0,.12)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <DialogPrimitive.Title className="text-[15px] font-bold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground">Închide</DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
