# /proiecte Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/proiecte` in the new visual language: header with a collapsible "Proiect nou" panel, and richer project cards showing status pill + cost materiale vs preț ofertă, per `docs/superpowers/specs/2026-07-15-proiecte-page-redesign-design.md`.

**Architecture:** Restyle in place. The page stays a server component; one new client component (`NewProjectPanel`) owns only the open/closed state and receives the server-rendered form as a prop. Prices are computed server-side per project by reusing `lib/quote/load.ts` + `lib/quote/basis.ts` — no new calculation logic.

**Tech Stack:** Next.js App Router, Tailwind v4 tokens from the reskin (`ring-border`, `bg-card`, `accent-blue` trio, `font-mono`).

## Global Constraints

- **No new tests** (directive 2026-07-14). Gate per task: `npx tsc --noEmit` clean; final gate adds `npm run build` + browser smoke.
- Zero changes to server actions (`createProject`, `duplicateProject`, `deleteProject`), engine, quote computation, routes, `DeleteButton` (confirm stays).
- Live snapshot built ONCE via `buildSnapshot()` and shared across all CIORNA projects; frozen projects parse their own `snapshotJson` (mirrors `getQuoteBasis` semantics using exported `isFrozenStatus` — do not call `getQuoteBasis` per project, it would rebuild the live snapshot N times).
- Any calculation failure per project → both prices render `—`; the card still renders.
- All UI copy Romanian, exactly as written in the code blocks below.
- Repo root: `/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare`. Note: `createProject` redirects to the new project page after create — the panel needs no post-submit close handling.

---

### Task 1: `NewProjectPanel` client component

**Files:**
- Create: `components/NewProjectPanel.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`.
- Produces: `NewProjectPanel({ form: ReactNode })` — renders the page header row (`Proiecte` title + toggle button) and, when open, a white panel containing `form`. Task 2 imports it.

- [ ] **Step 1: Create `components/NewProjectPanel.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected clean (component not yet used; that's fine).

- [ ] **Step 3: Commit**

```bash
git add components/NewProjectPanel.tsx
git commit -m "feat: NewProjectPanel — header cu panou colapsabil pentru proiect nou"
```

---

### Task 2: Rewrite `app/proiecte/page.tsx`

**Files:**
- Modify: `app/proiecte/page.tsx` (full rewrite, currently 69 lines)

**Interfaces:**
- Consumes: `NewProjectPanel({ form })` (Task 1); existing: `loadProject`, `legHeightByCabinet`, `toQuoteInput`, `tryComputeQuote` from `@/lib/quote/load`; `isFrozenStatus` from `@/lib/quote/basis`; `buildSnapshot` from `@/lib/quote/snapshot`; `SnapshotData` type from `@/lib/quote/compute`; `fmtLei` from `@/lib/format`; `cn` from `@/lib/utils`; `ActionForm`, `DeleteButton`, `SubmitButton`, `TextInput`, `Button`.
- Produces: the final page; nothing downstream.

- [ ] **Step 1: Replace the whole file with:**

```tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { createProject, deleteProject, duplicateProject } from '@/lib/quote/actions';
import { isFrozenStatus } from '@/lib/quote/basis';
import { buildSnapshot } from '@/lib/quote/snapshot';
import type { SnapshotData } from '@/lib/quote/compute';
import { legHeightByCabinet, loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import { fmtLei } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { NewProjectPanel } from '@/components/NewProjectPanel';
import { SubmitButton, TextInput } from '@/components/forms';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  CIORNA: 'Ciornă', TRIMISA: 'Trimisă', ACCEPTATA: 'Acceptată',
};

const STATUS_PILL_CLS: Record<string, string> = {
  CIORNA: 'bg-muted text-muted-foreground',
  TRIMISA: 'border border-accent-blue-border bg-accent-blue text-accent-blue-foreground',
  ACCEPTATA: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
};

const dateFmt = new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });

type ProjectRow = {
  id: string;
  name: string;
  clientName: string | null;
  status: string;
  cabinetCount: number;
  updatedAt: Date;
  totalCost: number | null;
  sellPrice: number | null;
};

async function loadRows(): Promise<ProjectRow[]> {
  const ids = await prisma.project.findMany({ orderBy: { updatedAt: 'desc' }, select: { id: true } });
  const liveSnapshot = ids.length > 0 ? await buildSnapshot() : null;
  const rows: ProjectRow[] = [];
  for (const { id } of ids) {
    const loaded = await loadProject(id);
    if (!loaded) continue;
    const { project, assemblies, cabinets } = loaded;
    let totalCost: number | null = null;
    let sellPrice: number | null = null;
    try {
      const snapshot: SnapshotData | null = isFrozenStatus(project.status)
        ? (project.snapshotJson ? (JSON.parse(project.snapshotJson) as SnapshotData) : null)
        : liveSnapshot;
      if (snapshot) {
        const { quote } = tryComputeQuote(
          toQuoteInput(project, cabinets, legHeightByCabinet(assemblies, cabinets)),
          snapshot,
        );
        if (quote) {
          totalCost = quote.costs.totalCost;
          sellPrice = quote.costs.sellPrice;
        }
      }
    } catch {
      // snapshot corupt sau altă eroare — prețurile rămân null → „—"
    }
    rows.push({
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      status: project.status,
      cabinetCount: cabinets.length,
      updatedAt: project.updatedAt,
      totalCost,
      sellPrice,
    });
  }
  return rows;
}

function PriceStat({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">{label}</div>
      <div className={cn('mt-0.5 font-mono text-base font-semibold tracking-tight', accent && 'text-accent-blue-foreground')}>
        {value != null ? fmtLei(value) : '—'}
      </div>
    </div>
  );
}

export default async function ProiectePage() {
  const rows = await loadRows();

  return (
    <div className="space-y-5">
      <NewProjectPanel
        form={
          <ActionForm action={createProject} className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
            <TextInput name="name" label="Nume proiect" />
            <TextInput name="clientName" label="Client" required={false} />
            <TextInput name="clientContact" label="Contact (telefon/email)" required={false} />
            <div><SubmitButton>Creează</SubmitButton></div>
          </ActionForm>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center">
          <p className="text-[15px] font-bold">Niciun proiect încă</p>
          <p className="mt-1 text-sm text-muted-foreground">Creează primul proiect ca să începi oferta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-border">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/proiecte/${p.id}`} className="text-[15px] font-bold leading-snug hover:underline">
                  {p.name}
                </Link>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    STATUS_PILL_CLS[p.status] ?? 'bg-muted text-muted-foreground',
                  )}
                >
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
              <div className="text-[12.5px] text-muted-foreground">
                {p.clientName ?? 'Fără client'} · <span className="font-mono">{p.cabinetCount}</span>{' '}
                {p.cabinetCount === 1 ? 'corp' : 'corpuri'} · {dateFmt.format(p.updatedAt)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PriceStat label="Cost materiale" value={p.totalCost} />
                <PriceStat label="Preț ofertă" value={p.sellPrice} accent />
              </div>
              <div className="mt-auto flex items-center gap-2 border-t pt-3">
                <ActionForm action={duplicateProject.bind(null, p.id)}>
                  <Button type="submit" variant="ghost" size="sm">Duplică</Button>
                </ActionForm>
                <DeleteButton action={deleteProject.bind(null, p.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Notes for the implementer:
- `Card/CardContent/CardHeader/CardTitle` and `Badge` imports from the old file are gone — do not leave them.
- `duplicateProject.bind(null, p.id)` / `deleteProject.bind(null, p.id)` — identical to the old file's bindings.
- `totalCost` excludes labor by design (labor lives only in `sellPrice`) — that IS "cost materiale".

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run build` — expected: compiled successfully, `/proiecte` builds.

- [ ] **Step 3: Commit**

```bash
git add "app/proiecte/page.tsx"
git commit -m "feat: redesign pagina /proiecte — carduri cu status pill și prețuri, panou proiect nou"
```

---

### Task 3: Final gate — smoke

**Files:** none new (fixes only, if smoke finds issues).

- [ ] **Step 1: Browser smoke (dev server, `rm -rf .next && npm run dev`)**

1. `/proiecte`: cards render with status pill, meta line (client · N corpuri · dd.mm.yyyy), and both prices; compare one project's figures against the „Rezumat" card on its `/proiecte/[id]` page — must match exactly.
2. „Proiect nou" opens/closes the panel (both the header button and „Anulează"); creating a project navigates to its page (existing redirect); delete the test project afterwards.
3. „Duplică" creates a copy (then delete it); „Șterge" still confirms before deleting.
4. A frozen project (TRIMISA/ACCEPTATA), if one exists in the dev DB, shows snapshot prices; if none exists, skip (code path covered by `isFrozenStatus` reuse).
5. Spot-check `/proiecte/[id]` and one corp page for regressions.

- [ ] **Step 2: Fix anything found, re-run `npx tsc --noEmit` + `npm run build`, commit fixes**

```bash
git add -A && git commit -m "fix: ajustări după smoke redesign /proiecte"
```

(Skip the commit if nothing needed fixing.)
