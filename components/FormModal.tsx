'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ModalCloseContext } from '@/components/modal-close';

/** Buton care deschide un formular (server) într-un modal; se închide singur la submit reușit
 *  (ActionForm consumă ModalCloseContext). */
export function FormModal({ trigger, title, variant, size, className, children }: {
  trigger: string;
  title: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>{trigger}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <ModalCloseContext.Provider value={() => setOpen(false)}>
          {children}
        </ModalCloseContext.Provider>
      </DialogContent>
    </Dialog>
  );
}
