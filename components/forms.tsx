import type { ReactNode } from 'react';

const inputCls = 'w-full rounded border border-neutral-300 px-2 py-1 text-sm';

export function TextInput(props: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600">{props.label}</span>
      <input type="text" name={props.name} defaultValue={props.defaultValue} required={props.required ?? true} className={inputCls} />
    </label>
  );
}

export function NumberInput(props: {
  name: string; label: string; defaultValue?: number | null; required?: boolean; step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600">{props.label}</span>
      <input
        type="number" name={props.name} step={props.step ?? '0.01'} min="0"
        defaultValue={props.defaultValue ?? undefined} required={props.required ?? true}
        className={inputCls}
      />
    </label>
  );
}

export function Select(props: {
  name: string; label: string; options: { value: string; label: string }[];
  defaultValue?: string | null; allowEmpty?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600">{props.label}</span>
      <select name={props.name} defaultValue={props.defaultValue ?? ''} className={inputCls}>
        {props.allowEmpty && <option value="">—</option>}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700">
      {children}
    </button>
  );
}
