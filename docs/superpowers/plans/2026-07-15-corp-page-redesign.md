# Corp Page Redesign + Global Reskin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the app (Instrument Sans + IBM Plex Mono, warm background, restyled nav) and rebuild the corp editor page as accordion sections with a sticky summary column, per `docs/superpowers/specs/2026-07-15-corp-page-redesign-design.md`.

**Architecture:** Approach A — restyle in place. Server page + client `CabinetEditorForm` + server-action forms stay; only presentation changes. Feronerie/Piese suplimentare move into the accordion as server-rendered JSX slots passed to the client form.

**Tech Stack:** Next.js App Router, Tailwind v4 + shadcn tokens, `next/font/google`.

## Global Constraints

- **No new tests** (directive 2026-07-14). Gate per task: `npx tsc --noEmit` clean; final gate adds `npm run build` + browser smoke.
- Zero changes to: engine, estimate, zod schema, server actions, form state wiring, MaterialPicker behavior.
- All UI copy stays Romanian, exactly as in the spec tables.
- **Spec deviation (approved rationale):** `--radius` stays `0.625rem` — shadcn maps cards to `radius-xl = 1.4 × radius` = 14px, already matching the mockup's 13–14px. Do NOT set 0.8125rem (would give 18px cards).
- Repo root: `/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare`. Line numbers below refer to file state at commit `c4d23d9`.

---

### Task 1: Global reskin — fonts, tokens, nav, card border, field labels

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/ui/card.tsx:15` (ring color only)
- Modify: `components/forms.tsx` (field label style, exported)
- Modify: `components/MaterialPicker.tsx:103` (label style)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS vars `--font-mono`, `--accent-blue`, `--accent-blue-foreground`, `--accent-blue-border` (usable as `font-mono`, `bg-accent-blue`, `text-accent-blue-foreground`, `border-accent-blue-border`); `export const fieldLabelCls: string` from `components/forms.tsx`. Task 3 uses all of these.

- [ ] **Step 1: Fonts + nav in `app/layout.tsx`**

Replace the whole file with:

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const sans = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-mono' });

export const metadata = { title: 'EpicMob Ofertare' };

const NAV = [
  { href: '/proiecte', label: 'Proiecte' },
  { href: '/cataloage/materiale', label: 'Materiale' },
  { href: '/cataloage/canturi', label: 'Canturi' },
  { href: '/cataloage/feronerie', label: 'Feronerie' },
  { href: '/cataloage/debitare', label: 'Debitare' },
  { href: '/setari', label: 'Setări' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" className={cn("font-sans", sans.variable, mono.variable)}>
      <body className="min-h-screen bg-background text-foreground">
        <header className="border-b bg-white print:hidden">
          <nav className="mx-auto flex max-w-[1340px] items-center gap-9 px-6 py-4">
            <Link href="/" className="text-[15px] font-bold tracking-tight">
              EpicMob <span className="font-medium text-muted-foreground">Ofertare</span>
            </Link>
            <div className="flex items-center gap-5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-[1340px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
```

(Removes the `Geist` and `Button` imports; nav links become plain text.)

- [ ] **Step 2: Tokens in `app/globals.css`**

In the `@theme inline` block, after line 9 (`--font-sans: var(--font-sans);`) add:

```css
    --font-mono: var(--font-mono);
    --color-accent-blue: var(--accent-blue);
    --color-accent-blue-foreground: var(--accent-blue-foreground);
    --color-accent-blue-border: var(--accent-blue-border);
```

In `:root`, replace these existing lines (keep everything else, including `--radius: 0.625rem`):

```css
    --background: #eceae4;
    --card: #ffffff;
    --primary: #18181b;
    --secondary: #f0f0ec;
    --muted: #f0f0ec;
    --muted-foreground: #71717a;
    --accent: #f0f0ec;
    --border: #e6e6e2;
    --input: #e4e4e1;
```

and add at the end of `:root` (before the closing brace):

```css
    --accent-blue: oklch(0.97 0.02 245);
    --accent-blue-foreground: oklch(0.5 0.1 245);
    --accent-blue-border: oklch(0.9 0.03 245);
```

Leave the `.dark` block untouched (no dark toggle exists).

- [ ] **Step 3: Card border in `components/ui/card.tsx`**

On line 15, replace `ring-1 ring-foreground/10` with `ring-1 ring-border` (inside the `Card` className string). No other changes.

- [ ] **Step 4: Micro field labels**

In `components/forms.tsx`, after the imports (line 5) add:

```tsx
export const fieldLabelCls = 'text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground';
```

Then apply it to the three `<Label htmlFor={props.name}>` usages in this file (TextInput line 17, NumberInput line 34, Select line 54), e.g.:

```tsx
      <Label htmlFor={props.name} className={fieldLabelCls}>{props.label}</Label>
```

In `components/MaterialPicker.tsx` line 103, change `<Label>{label}</Label>` to:

```tsx
      <Label className={fieldLabelCls}>{label}</Label>
```

and add the import: `import { fieldLabelCls } from '@/components/forms';`

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected: no output (clean).
Run: `npm run dev` and open `http://localhost:3000/proiecte` — expected: warm greige background, white nav bar with plain gray links, Instrument Sans everywhere, white cards with light warm borders. Check one print page (`/proiecte/<id>/plan-debitare`) stays white.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/globals.css components/ui/card.tsx components/forms.tsx components/MaterialPicker.tsx
git commit -m "feat: reskin global — Instrument Sans + IBM Plex Mono, tokens calde, nav restilizat"
```

---

### Task 2: New primitives — SectionAccordion + SegmentedControl

**Files:**
- Create: `components/ui/section-accordion.tsx`
- Create: `components/ui/segmented-control.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`; tokens from Task 1 (`bg-muted`, `ring-border`).
- Produces:
  - `SectionAccordion({ title: string; summary?: string; open: boolean; onToggle: () => void; children: ReactNode })`
  - `SegmentedControl({ value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string })`

  Task 3 imports both.

- [ ] **Step 1: Create `components/ui/section-accordion.tsx`**

```tsx
'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionAccordion({ title, summary, open, onToggle, children }: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-foreground">{title}</div>
          {summary && <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground/80">{summary}</div>}
        </div>
        <span
          aria-hidden
          className={cn('text-lg leading-none text-muted-foreground/70 transition-transform duration-200', open && 'rotate-90')}
        >
          ›
        </span>
      </button>
      {open && <div className="border-t px-5 pt-4 pb-5">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/ui/segmented-control.tsx`**

```tsx
'use client';

import { cn } from '@/lib/utils';

export function SegmentedControl({ value, onChange, options, className }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'cursor-pointer rounded-lg px-4 py-2 text-[13px] transition-colors',
            o.value === value
              ? 'bg-white font-semibold text-foreground shadow-sm'
              : 'font-medium text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` — expected clean (components not yet used; that's fine).

```bash
git add components/ui/section-accordion.tsx components/ui/segmented-control.tsx
git commit -m "feat: primitive SectionAccordion și SegmentedControl"
```

---

### Task 3: Corp page rework — accordion + sticky summary + slots

**Files:**
- Modify: `components/CabinetEditorForm.tsx`
- Modify: `app/proiecte/[id]/corp/[cabinetId]/page.tsx`

Both files change in one task/commit — the form gains required slot props the page must supply, so splitting would break `tsc` mid-way.

**Interfaces:**
- Consumes: `SectionAccordion`, `SegmentedControl` (Task 2); `fieldLabelCls` (Task 1); everything already imported by the two files.
- Produces: `CabinetEditorFormProps` gains four required props:
  - `feronerieSlot: ReactNode`
  - `feronerieSummary: string`
  - `extraPartsSlot: ReactNode`
  - `extraPartsSummary: string`

- [ ] **Step 1: `CabinetEditorForm.tsx` — imports and props**

Add imports:

```tsx
import type { ReactNode } from 'react';
import { SectionAccordion } from '@/components/ui/section-accordion';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { fieldLabelCls } from '@/components/forms';
```

Remove the now-unused imports: `Card, CardContent, CardHeader, CardTitle` and `RadioGroup, RadioGroupItem` (verify with tsc after the rewrite; `Badge`, `Table*`, `Checkbox`, `Input`, `Label`, `Button`, `Alert*` stay).

In `CabinetEditorFormProps` (after `extraParts: ExtraPart[];`, line 73) add:

```tsx
  feronerieSlot: ReactNode;
  feronerieSummary: string;
  extraPartsSlot: ReactNode;
  extraPartsSummary: string;
```

and destructure them in the component body alongside the existing props (line 87–91):

```tsx
    feronerieSlot, feronerieSummary, extraPartsSlot, extraPartsSummary,
```

- [ ] **Step 2: `CabinetEditorForm.tsx` — accordion state + header summaries**

After the `backEnabled` line (line 218), insert:

```tsx
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['dimensiuni']));
  const toggleSection = (id: string) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const typeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
  const dimSummary = `${values.label} · ${typeLabel} · ${values.widthMm} × ${values.heightMm} × ${values.depthMm}`;
  const matSummary = [materialName(values.carcassMaterialId), bandName(values.carcassFrontEdgeId)]
    .filter(Boolean).join(' · ') || '—';
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const handleSummary = values.handleMode === 'PROIECT' ? 'mâner ca proiectul' : 'mâner pe corp';
  const frontSummary =
    frontType === 'USI'
      ? [
          `Uși · ${plural(Number(values.doors) || 0, 'ușă', 'uși')}`,
          withShelves ? plural(Number(values.shelves) || 0, 'poliță', 'polițe') : null,
          handleSummary,
        ].filter(Boolean).join(' · ')
      : frontType === 'SERTARE'
        ? `Sertare · ${plural(drawersCount, 'sertar', 'sertare')} · ${handleSummary}`
        : `Fără front · ${plural(Number(values.shelves) || 0, 'poliță', 'polițe')}`;
  const backSummary = backEnabled
    ? ['Cu spate', values.backMaterialId ? materialName(values.backMaterialId) : null,
       BACK_MOUNT_OPTIONS.find((o) => o.value === values.backMount)?.label.toLowerCase() ?? null]
        .filter(Boolean).join(' · ')
    : 'Fără spate';
```

- [ ] **Step 3: `CabinetEditorForm.tsx` — new return statement**

Replace the entire `return (...)` of `CabinetEditorForm` (lines 220–575) with the JSX below. Markers like `[MOVE lines A–B unchanged]` mean: cut that exact JSX block from the old return and paste it there verbatim — those blocks contain field logic that must not change.

```tsx
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="flex flex-col gap-3">
        <SectionAccordion title="Identificare și dimensiuni" summary={dimSummary}
          open={openSections.has('dimensiuni')} onToggle={() => toggleSection('dimensiuni')}>
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="label" className={fieldLabelCls}>Etichetă</Label>
              <Input id="label" value={values.label} onChange={(e) => set('label', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label className={fieldLabelCls}>Tip corp</Label>
              <SegmentedControl value={type} onChange={(v) => set('type', v)} options={TYPE_OPTIONS} />
            </div>
            {/* [MOVE lines 243–255 unchanged: the L/H/A + panou orb grid and the blat/fund selects grid] */}
          </div>
        </SectionAccordion>

        <SectionAccordion title="Materiale și canturi" summary={matSummary}
          open={openSections.has('materiale')} onToggle={() => toggleSection('materiale')}>
          <div className="space-y-3">
            {/* [MOVE lines 262–272 unchanged: MaterialPicker/cant grid + noPriceMaterials warning] */}
          </div>
        </SectionAccordion>

        <SectionAccordion title="Fronturi" summary={frontSummary}
          open={openSections.has('fronturi')} onToggle={() => toggleSection('fronturi')}>
          <div className="space-y-4">
            <SegmentedControl
              value={frontType}
              onChange={(v) => setValues((prev) => ({
                ...prev, frontType: v,
                ...(v === 'USI' && !doorsTouched ? { doors: String(autoDoors(Number(prev.widthMm))) } : {}),
                ...(v === 'SERTARE' && drawersCount === 0
                  ? { drawersCount: '3', drawerFrontHeightsMm: equalHeights(Number(prev.heightMm), 3).join(', ') }
                  : {}),
              }))}
              options={FRONT_TYPE_OPTIONS}
            />
            {/* [MOVE lines 298–435 unchanged: the three frontType conditional blocks (USI / SERTARE / FARA) and the Mâner block] */}
          </div>
        </SectionAccordion>

        <SectionAccordion title="Spate" summary={backSummary}
          open={openSections.has('spate')} onToggle={() => toggleSection('spate')}>
          <div className="space-y-3">
            {/* [MOVE lines 442–455 unchanged: checkbox „Cu spate" + material/montaj grid] */}
          </div>
        </SectionAccordion>

        <SectionAccordion title="Feronerie" summary={feronerieSummary}
          open={openSections.has('feronerie')} onToggle={() => toggleSection('feronerie')}>
          {feronerieSlot}
        </SectionAccordion>

        <SectionAccordion title="Piese suplimentare" summary={extraPartsSummary}
          open={openSections.has('suplimentare')} onToggle={() => toggleSection('suplimentare')}>
          {extraPartsSlot}
        </SectionAccordion>

        <div className="mt-1.5 space-y-2">
          <Button onClick={handleSave} disabled={isPending} size="lg">
            {isPending ? 'Se salvează…' : 'Salvează corpul'}
          </Button>
          {/* [MOVE lines 463–474 unchanged: formState.error Alert + zod issues Alert] */}
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        <div className="rounded-xl bg-card p-5 ring-1 ring-border">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-[15px] font-bold">Preț estimativ</div>
            {invalid && <Badge variant="outline" className="border-amber-500 text-amber-700">valori invalide</Badge>}
          </div>
          {displayPrice ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#ececea] bg-[#fafaf8] px-4 py-3.5">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Cost</div>
                <div className="font-mono text-[22px] font-semibold tracking-tight">{fmtLei(displayPrice.cost)}</div>
              </div>
              <div className="rounded-lg border border-accent-blue-border bg-accent-blue px-4 py-3.5">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-accent-blue-foreground">Preț vânzare</div>
                <div className="font-mono text-[22px] font-semibold tracking-tight text-accent-blue-foreground">{fmtLei(displayPrice.sell)}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Fără preț disponibil încă.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Estimativ — prețul final rotunjește foile pe proiect.</p>
          {live?.estimate.error && (
            <Alert variant="destructive" className="mt-3"><AlertDescription>{live.estimate.error}</AlertDescription></Alert>
          )}
        </div>

        {/* [MOVE lines 514–524 unchanged: expandError Alert + warnings list] */}

        <div className="rounded-xl bg-card p-5 ring-1 ring-border">
          <div className="mb-3 text-[15px] font-bold">Piese generate</div>
          {live && !live.expandError ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Piesă</TableHead>
                  <TableHead>Dim. (mm)</TableHead>
                  <TableHead>Buc</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Canturi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {live.parts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtNum(p.lengthMm, 1)}×{fmtNum(p.widthMm, 1)}</TableCell>
                    <TableCell className="font-mono">{p.qty}</TableCell>
                    <TableCell>{materialName(p.materialId)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[p.edges.l1, p.edges.l2, p.edges.w1, p.edges.w2].filter(Boolean).map((b) => bandName(b)).join(', ') || '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {live.parts.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nicio piesă.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {invalid ? 'Corectează formularul pentru a vedea piesele.' : 'Nu se pot genera piese.'}
            </p>
          )}
        </div>

        {live && !live.expandError && (
          <div className="rounded-xl bg-card p-5 ring-1 ring-border">
            <div className="mb-1 text-[15px] font-bold">Previzualizare</div>
            <CabinetIsoSvg input={live.input} cc={cc} />
          </div>
        )}
      </div>
    </div>
  );
```

- [ ] **Step 4: `CabinetEditorForm.tsx` — helper components**

At the bottom of the file, update `NumField` and `SelectField` to the micro-label + mono style:

```tsx
function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label className={fieldLabelCls}>{label}</Label>
      <Input type="number" step="1" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="font-mono" />
    </div>
  );
}
```

```tsx
function SelectField({ label, value, onChange, options, allowEmpty }: {
  label: string; value: string; onChange: (v: string) => void;
  options: FieldOption[]; allowEmpty?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className={fieldLabelCls}>{label}</Label>
      <select className={selectCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
```

Also apply `className={fieldLabelCls}` to the two inline `<Label>` usages that remain in moved blocks: the tandembox `<Label>Înălțime laterală (mm)</Label>` (old line 348) and the Mâner section `<Label>Mâner</Label>` (old line 399). Checkbox labels (`Cu polițe…`, `Cu spate`) keep `font-normal` — do NOT uppercase them.

- [ ] **Step 5: `page.tsx` — header, slots, summaries**

In `app/proiecte/[id]/corp/[cabinetId]/page.tsx`:

(a) Compute summaries after `overridesStale` (line 175):

```tsx
  const feronerieSummary = overrides !== null
    ? 'Editată manual'
    : suggestedLines.length + unresolvedSuggestions.length === 0
      ? 'Nicio sugestie'
      : `${suggestedLines.length + unresolvedSuggestions.length} sugestii automate`;
  const extraPartsSummary = extraParts.length === 0
    ? 'Nicio piesă suplimentară'
    : `${extraParts.length} ${extraParts.length === 1 ? 'piesă' : 'piese'}`;
```

(b) Replace the page header block (lines 179–182) with:

```tsx
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Corp: <span className="font-mono text-xl">{input.label}</span>
        </h1>
        <Link href={`/proiecte/${id}`} className="text-[13px] font-medium text-accent-blue-foreground hover:underline">
          ← Înapoi la proiect
        </Link>
      </div>
```

(c) Delete the two `<Card>` blocks „Feronerie" (lines 220–290) and „Piese suplimentare" (lines 292–315). Take their inner `<CardContent>` children **verbatim** and define them as slot variables before the `return`:

```tsx
  const feronerieSlot = (
    <>
      {/* [MOVE lines 223–288 unchanged: the full overrides === null ? (...) : (...) ternary] */}
    </>
  );
  const extraPartsSlot = (
    <>
      {/* [MOVE lines 295–313 unchanged: the extra-parts <ul> + the addExtraPart ActionForm] */}
    </>
  );
```

(d) Pass them to the form — add to the `<CabinetEditorForm …>` props:

```tsx
        feronerieSlot={feronerieSlot}
        feronerieSummary={feronerieSummary}
        extraPartsSlot={extraPartsSlot}
        extraPartsSummary={extraPartsSummary}
```

(e) Remove the now-unused imports `Card, CardContent, CardHeader, CardTitle` from page.tsx (the `Alert` imports stay — the inactive-refs alert at lines 184–190 is unchanged). The outer `<div className="space-y-8">` wrapper stays; tighten to `space-y-5`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run dev`, open a corp page. Expected: accordion left (only „Identificare și dimensiuni" open), sticky summary right; toggling sections works independently; summaries update live while typing; segmented pills switch tip corp / tip front and conditional fields appear; Feronerie/Piese suplimentare render inside their sections with working buttons.

- [ ] **Step 7: Commit**

```bash
git add components/CabinetEditorForm.tsx "app/proiecte/[id]/corp/[cabinetId]/page.tsx"
git commit -m "feat: pagina corp — accordion cu sumare live + coloană sumar sticky"
```

---

### Task 4: Final gate — build + smoke

**Files:** none new (fixes only, if smoke finds issues).

- [ ] **Step 1: Type check + production build**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run build` — expected: compiled successfully, all routes build.

- [ ] **Step 2: Browser smoke (dev server)**

On a corp page:
1. Toggle all 6 sections open simultaneously, then closed — headers show correct summaries when collapsed.
2. Switch Tip front Uși → Sertare → Fără front: conditional fields (sertare + înălțimi + tandembox / polițe) appear correctly; price + Piese generate update live.
3. Edit L to 800 → doors auto-becomes 2 (if untouched), dim summary + preview update.
4. Salvează corpul → success, refresh keeps values.
5. Feronerie: „Preia în editor" → overrides mode renders in-section; „Revino la sugestiile automate" works; summary shows „Editată manual".
6. Piese suplimentare: add one (summary → „1 piesă"), delete it.
7. Spot-check `/proiecte`, `/setari`, `/cataloage/materiale`, `/proiecte/<id>/oferta` and `/proiecte/<id>/plan-debitare` (print preview white, no layout breakage).

- [ ] **Step 3: Fix anything found, re-run gate, commit fixes**

```bash
git add -A && git commit -m "fix: ajustări după smoke redesign corp"
```

(Skip the commit if nothing needed fixing.)
