'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ModalCloseContext } from '@/components/modal-close';

/** Buton „Adaugă ansamblu" care deschide formularul (server) într-un modal. Se închide
 *  singur la submit reușit (prin ModalCloseContext, consumat de ActionForm). */
export function AssemblyAddModal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Adaugă ansamblu</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Ansamblu nou</DialogTitle></DialogHeader>
        <ModalCloseContext.Provider value={() => setOpen(false)}>
          {children}
        </ModalCloseContext.Provider>
      </DialogContent>
    </Dialog>
  );
}

/** Card de ansamblu colapsabil: header mereu vizibil (nume + rezumat), corp colapsabil,
 *  editarea într-un modal declanșat de „Editează". */
export function AssemblyCardShell({
  name, metaText, threeDSlot, deleteSlot, editForm, children,
}: {
  name: string;
  metaText: string;
  threeDSlot: ReactNode;
  deleteSlot: ReactNode;
  editForm: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-start gap-2 text-left"
            aria-expanded={open}
          >
            <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
            <CardTitle>{name} <span className="font-normal text-muted-foreground">{metaText}</span></CardTitle>
          </button>
          <div className="flex items-center gap-1.5">
            {threeDSlot}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">Editează</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Editează ansamblul</DialogTitle></DialogHeader>
                <ModalCloseContext.Provider value={() => setEditOpen(false)}>
                  {editForm}
                </ModalCloseContext.Provider>
              </DialogContent>
            </Dialog>
            {deleteSlot}
          </div>
        </div>
      </CardHeader>
      {open && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
}
