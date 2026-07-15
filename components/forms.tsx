import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export const fieldLabelCls = 'text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground';

const selectCls = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
  'md:text-sm dark:bg-input/30 dark:disabled:bg-input/80',
);

export function TextInput(props: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={props.name} className={fieldLabelCls}>{props.label}</Label>
      <Input
        id={props.name}
        type="text"
        name={props.name}
        defaultValue={props.defaultValue}
        required={props.required ?? true}
      />
    </div>
  );
}

export function NumberInput(props: {
  name: string; label: string; defaultValue?: number | null; required?: boolean; step?: string; min?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={props.name} className={fieldLabelCls}>{props.label}</Label>
      <Input
        id={props.name}
        type="number"
        name={props.name}
        step={props.step ?? '0.01'}
        min={props.min ?? '0'}
        defaultValue={props.defaultValue ?? undefined}
        required={props.required ?? true}
      />
    </div>
  );
}

export function Select(props: {
  name: string; label: string; options: { value: string; label: string }[];
  defaultValue?: string | null; allowEmpty?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={props.name} className={fieldLabelCls}>{props.label}</Label>
      <select id={props.name} name={props.name} defaultValue={props.defaultValue ?? ''} className={selectCls}>
        {props.allowEmpty && <option value="">—</option>}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return <Button type="submit">{children}</Button>;
}
